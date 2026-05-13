/**
 * 摄像头人脸拍照组件
 * 支持自动人脸检测（Chrome/Edge）和手动拍照两种模式
 * 检测到人脸稳定后自动截取，无需点击按钮
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button, message } from 'antd';
import {
  CameraOutlined,
  ReloadOutlined,
  SwapOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

interface FaceCameraProps {
  /** 捕获到人脸时的回调（base64） */
  onCapture: (base64: string) => void;
  width?: number;
  height?: number;
}

// 连续多少帧检测到人脸后才认为稳定
const STABLE_THRESHOLD = 3;
// 检测间隔（ms）
const DETECT_INTERVAL = 200;

export default function FaceCamera({
  onCapture,
  width = 320,
  height = 240,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableCountRef = useRef(0);
  const capturedRef = useRef(false); // 避免重复 capture
  const autoSupportedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBox, setFaceBox] = useState<DOMRectReadOnly | null>(null);
  const [autoSupported, setAutoSupported] = useState(false);

  /**
   * 停止流
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
    stopDetection();
  }, []);

  /**
   * 绘制检测框叠加层
   */
  const drawFaceBox = useCallback(
    (box: DOMRectReadOnly | null) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (!box) return;

      const scaleX = overlay.width / (videoRef.current?.videoWidth || 1);
      const scaleY = overlay.height / (videoRef.current?.videoHeight || 1);

      // 前置摄像头需要水平翻转坐标
      const x =
        facingMode === 'user'
          ? overlay.width - box.x * scaleX - box.width * scaleX
          : box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;

      // 检测框
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // 跟角装饰
      const cornerLen = Math.min(w, h) * 0.15;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // 左上
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      // 右上
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      // 左下
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      // 右下
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();
    },
    [facingMode],
  );

  /**
   * 单次人脸检测
   */
  const detectOnce = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || capturedRef.current) return;

    try {
      const faces = await detector.detect(video);

      if (faces.length > 0) {
        const face = faces[0];

        // 检查人脸是否足够大（占画面一定比例）
        const faceArea = face.boundingBox.width * face.boundingBox.height;
        const videoArea = video.videoWidth * video.videoHeight;
        const ratio = faceArea / videoArea;

        if (ratio > 0.05) {
          setFaceBox(face.boundingBox);
          drawFaceBox(face.boundingBox);

          if (!faceDetected) {
            setFaceDetected(true);
          }

          // 连续检测到人脸达到阈值 → 自动捕获
          stableCountRef.current += 1;
          if (stableCountRef.current >= STABLE_THRESHOLD && !capturedRef.current) {
            capturedRef.current = true;
            setDetecting(false);
            setFaceDetected(false);
            stopDetection();

            // 延迟一小下让用户看到检测框，再 capture
            setTimeout(() => {
              doCapture();
            }, 300);
            return;
          }
        } else {
          resetFaceState();
        }
      } else {
        resetFaceState();
      }
    } catch {
      // 偶尔检测失败，忽略
    }
  }, [faceDetected, drawFaceBox]);

  const resetFaceState = useCallback(() => {
    stableCountRef.current = 0;
    setFaceDetected(false);
    setFaceBox(null);
    drawFaceBox(null);
  }, [drawFaceBox]);

  /**
   * 执行捕获
   */
  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 前置摄像头镜像翻转
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    setCaptured(base64);
    setFaceBox(null);
    drawFaceBox(null);
    onCapture(base64);
  }, [facingMode, drawFaceBox, onCapture]);

  /**
   * 启动检测循环
   */
  const startDetection = useCallback(() => {
    stopDetection();

    // 检查浏览器是否支持 FaceDetector
    if (!autoSupportedRef.current) {
      setAutoSupported(false);
      return;
    }

    try {
      detectorRef.current = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
    } catch {
      setAutoSupported(false);
      return;
    }

    setDetecting(true);
    stableCountRef.current = 0;
    capturedRef.current = false;
    setFaceDetected(false);
    setFaceBox(null);

    detectionTimerRef.current = setInterval(() => {
      detectOnce();
    }, DETECT_INTERVAL);
  }, [detectOnce]);

  /**
   * 停止检测循环
   */
  const stopDetection = useCallback(() => {
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    setDetecting(false);
    resetFaceState();
  }, [resetFaceState]);

  /**
   * 启动流
   */
  const startStream = useCallback(
    async (facing: 'user' | 'environment') => {
      stopStream();
      setError(null);
      setCaptured(null);
      capturedRef.current = false;
      setFaceBox(null);
      drawFaceBox(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: width },
            height: { ideal: height },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreaming(true);
      } catch {
        setError('无法访问摄像头，请检查浏览器权限设置');
      }
    },
    [stopStream, width, height, drawFaceBox],
  );

  // 初始化检测器支持和摄像头
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'FaceDetector' in window;
    autoSupportedRef.current = supported;
    setAutoSupported(supported);

    startStream(facingMode);
    return () => {
      stopStream();
      stopDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 流就绪后启动检测
  useEffect(() => {
    if (streaming && autoSupportedRef.current && !capturedRef.current) {
      // 等视频 frame 就绪再启动检测
      const timer = setTimeout(() => {
        startDetection();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [streaming, startDetection]);

  // 切换摄像头
  useEffect(() => {
    if (!streaming) return;
    startStream(facingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  /**
   * 手动拍照
   */
  const handleCapture = () => {
    capturedRef.current = true;
    stopDetection();
    doCapture();
  };

  const handleRetake = () => {
    setCaptured(null);
    capturedRef.current = false;
    if (autoSupportedRef.current) {
      startDetection();
    }
  };

  const handleSwitchCamera = () => {
    setCaptured(null);
    capturedRef.current = false;
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
        style={{ width, height }}
      >
        <p className="mb-2 text-sm text-gray-500">{error}</p>
        <Button icon={<ReloadOutlined />} onClick={() => startStream(facingMode)}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 摄像头预览 / 拍照结果 */}
      <div className="relative overflow-hidden rounded-lg" style={{ width, height }}>
        <div className="absolute inset-0 z-10">
          {captured ? (
            <img
              src={captured}
              alt="captured"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />
              {/* 人脸检测叠加层 */}
              <canvas
                ref={overlayRef}
                className="pointer-events-none absolute inset-0"
                width={width}
                height={height}
              />
            </>
          )}
        </div>

        {/* 状态提示 */}
        {!captured && streaming && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            {detecting && !faceDetected && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                <LoadingOutlined className="animate-spin" />
                检测中...
              </div>
            )}
            {faceDetected && !captured && (
              <div className="absolute bottom-3 flex items-center gap-1.5 rounded-full bg-green-500/80 px-3 py-1 text-xs text-white shadow">
                <CheckCircleOutlined />
                检测到人脸
              </div>
            )}
          </div>
        )}

        {/* 人脸引导框（无自动检测时的参考线） */}
        {!captured && streaming && !autoSupported && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="rounded-full border-2 border-white/40"
              style={{
                width: Math.min(width, height) * 0.65,
                height: Math.min(width, height) * 0.8,
              }}
            />
          </div>
        )}

        {/* AutoDetect 状态条 */}
        {!captured && streaming && autoSupported && !detecting && !faceDetected && (
          <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-amber-500/70 px-3 py-0.5 text-xs text-white">
            请使用支持人脸检测的浏览器
          </div>
        )}
      </div>

      {/* Canvas（隐藏） */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {captured ? (
          <Button icon={<ReloadOutlined />} onClick={handleRetake}>
            重拍
          </Button>
        ) : (
          <>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<CameraOutlined />}
              onClick={handleCapture}
              disabled={!streaming}
            />
            <Button
              icon={<SwapOutlined />}
              onClick={handleSwitchCamera}
              disabled={captured !== null}
            >
              切换
            </Button>
            {!autoSupported && (
              <span className="self-center text-xs text-gray-400">
                点击拍照按钮
              </span>
            )}
          </>
        )}
      </div>

      {/* 浏览器不支持提示 */}
      {!autoSupported && !captured && streaming && (
        <p className="text-center text-xs text-gray-400">
          当前浏览器不支持自动检测，请使用 Chrome/Edge 获得自动识别体验
        </p>
      )}
    </div>
  );
}
