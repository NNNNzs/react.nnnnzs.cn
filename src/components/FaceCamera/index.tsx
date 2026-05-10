/**
 * 摄像头人脸拍照组件
 * 开启前置摄像头，提供拍照功能，返回 base64 图片
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button, message } from 'antd';
import { CameraOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';

interface FaceCameraProps {
  onCapture: (base64: string) => void;
  width?: number;
  height?: number;
}

export default function FaceCamera({
  onCapture,
  width = 320,
  height = 240,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const startStream = useCallback(
    async (facing: 'user' | 'environment') => {
      stopStream();
      setError(null);
      setCaptured(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: width }, height: { ideal: height } },
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
    [stopStream, width, height],
  );

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
  }, [facingMode, startStream, stopStream]);

  const handleCapture = () => {
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
    onCapture(base64);
  };

  const handleRetake = () => {
    setCaptured(null);
  };

  const handleSwitchCamera = () => {
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
        {captured ? (
          <img src={captured} alt="captured" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* 人脸引导框 */}
        {!captured && streaming && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full border-2 border-white/60"
              style={{ width: Math.min(width, height) * 0.65, height: Math.min(width, height) * 0.8 }}
            />
          </div>
        )}
      </div>

      {/* Canvas（隐藏） */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {captured ? (
          <>
            <Button icon={<ReloadOutlined />} onClick={handleRetake}>
              重拍
            </Button>
          </>
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
            <Button icon={<SwapOutlined />} onClick={handleSwitchCamera}>
              切换
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
