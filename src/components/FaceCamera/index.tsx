/**
 * 摄像头人脸拍照组件
 * 使用 face-api.js (TinyFaceDetector) 在浏览器端实时检测人脸
 * 检测到人脸稳定后自动截取，无需手动点击拍照
 *
 * 模型加载：浏览器从 CDN 加载模型文件，不需服务端存储
 */

'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import {
  CameraOutlined,
  ReloadOutlined,
  SwapOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import * as faceapi from '@vladmandic/face-api';

interface FaceCameraProps {
  /** 捕获到人脸时的回调（base64） */
  onCapture: (base64: string) => void;
  width?: number;
  height?: number;
}

/** 连续多少帧检测到人脸后才认为稳定 */
const STABLE_THRESHOLD = 3;
/** 检测间隔（ms） */
const DETECT_INTERVAL = 200;

/** 模型文件路径（从 public/models 目录加载） */
const MODEL_URL = '/models';

export default function FaceCamera({
  onCapture,
  width = 320,
  height = 240,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableCountRef = useRef(0);
  const capturedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  /**
   * 加载 TinyFaceDetector 模型
   */
  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        setModelLoading(true);
        // 使用 face-api.js 内置的权重加载，传入包含模型文件的目录 URL
        await faceapi.nets.tinyFaceDetector.load(MODEL_URL);
        if (!cancelled) {
          setModelReady(true);
          setModelLoading(false);
        }
      } catch {
        if (!cancelled) {
          setModelReady(false);
          setModelLoading(false);
          setModelError(true);
        }
      }
    };

    loadModel();
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 绘制检测框叠加层
   */
  const drawFaceBox = useCallback(
    (box: faceapi.IRect | null) => {
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

      // 四角装饰
      const cornerLen = Math.min(w, h) * 0.15;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();
    },
    [facingMode],
  );

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
    drawFaceBox(null);
    onCapture(base64);
  }, [facingMode, drawFaceBox, onCapture]);

  /**
   * 停止检测循环
   */
  const stopDetection = useCallback(() => {
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    setDetecting(false);
    stableCountRef.current = 0;
    setFaceDetected(false);
    drawFaceBox(null);
  }, [drawFaceBox]);

  /**
   * 单次人脸检测
   */
  const detectOnce = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturedRef.current) return;

    try {
      const face = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }),
      );

      if (face) {
        const { box } = face;
        drawFaceBox(box);

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

          // 延迟一小下让用户看到检测框
          setTimeout(() => {
            doCapture();
          }, 300);
          return;
        }
      } else {
        stableCountRef.current = 0;
        setFaceDetected(false);
        drawFaceBox(null);
      }
    } catch {
      // 偶尔检测失败，忽略
    }
  }, [faceDetected, drawFaceBox, doCapture, stopDetection]);

  /**
   * 启动检测循环
   */
  const startDetection = useCallback(() => {
    stopDetection();
    setDetecting(true);
    stableCountRef.current = 0;
    capturedRef.current = false;
    setFaceDetected(false);
    drawFaceBox(null);

    detectionTimerRef.current = setInterval(() => {
      detectOnce();
    }, DETECT_INTERVAL);
  }, [detectOnce, drawFaceBox, stopDetection]);

  /**
   * 启动流
   */
  const startStream = useCallback(
    async (facing: 'user' | 'environment') => {
      stopStream();
      setError(null);
      setCaptured(null);
      capturedRef.current = false;
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

  // 初始化摄像头
  useEffect(() => {
    startStream(facingMode);
    return () => {
      stopStream();
      stopDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换摄像头
  useEffect(() => {
    if (!streaming) return;
    startStream(facingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // 模型就绪 + 流就绪 → 启动检测
  useEffect(() => {
    if (streaming && modelReady && !capturedRef.current) {
      const timer = setTimeout(() => {
        startDetection();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, modelReady]);

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
    if (modelReady) {
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
        {!captured && streaming && !captured && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            {/* 模型加载中 */}
            {modelLoading && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                <LoadingOutlined className="animate-spin" />
                加载模型...
              </div>
            )}
            {/* 检测中 */}
            {modelReady && detecting && !faceDetected && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                <LoadingOutlined className="animate-spin" />
                检测中...
              </div>
            )}
            {/* 模型加载失败 */}
            {modelError && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/80 px-3 py-1 text-xs text-white">
                <WarningOutlined />
                模型加载失败，请手动拍照
              </div>
            )}
          </div>
        )}

        {/* 检测到人脸提示（底部） */}
        {!captured && streaming && faceDetected && modelReady && (
          <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-green-500/80 px-3 py-1 text-xs text-white shadow">
            <CheckCircleOutlined className="mr-1" />
            检测到人脸
          </div>
        )}

        {/* 无自动检测时的引导框 */}
        {!captured && streaming && !modelReady && (
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
            <Button variant="solid" color="primary"
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
          </>
        )}
      </div>

      {!captured && streaming && modelError && (
        <p className="text-center text-xs text-gray-400">
          模型加载失败，请刷新页面重试，或手动拍照使用
        </p>
      )}
    </div>
  );
}
