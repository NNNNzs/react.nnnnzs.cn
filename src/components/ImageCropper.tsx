/**
 * 通用图片裁剪组件
 * 使用 react-cropper 实现图片裁剪功能
 * 支持自由裁剪和固定比例裁剪
 */

"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Modal, Button, Space, Typography, Alert, Checkbox, Divider } from "antd";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import type { ReactCropperElement } from "react-cropper";

const { Text } = Typography;

interface ImageCropperProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 图片源（File 对象或 URL） */
  imageSrc: string | File | null;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 确认裁剪回调，返回裁剪后的图片 Blob */
  onConfirm: (blob: Blob) => Promise<void>;
  /** 默认裁剪框宽高比（当锁定比例时使用），0 表示自由比例 */
  defaultAspectRatio?: number;
  /** 裁剪框的最小尺寸 */
  minCropBoxWidth?: number;
  /** 裁剪框的最小高度 */
  minCropBoxHeight?: number;
  /** 弹窗标题 */
  title?: string;
  /** 是否允许修改横纵比，默认 true */
  allowChangeAspectRatio?: boolean;
}

/**
 * 通用图片裁剪组件
 */
export default function ImageCropper({
  open,
  imageSrc,
  onClose,
  onConfirm,
  defaultAspectRatio = 0, // 0 表示自由比例
  minCropBoxWidth = 50,
  minCropBoxHeight = 50,
  title = "裁剪图片",
  allowChangeAspectRatio = true,
}: ImageCropperProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null);
  const [lockAspectRatio, setLockAspectRatio] = useState(defaultAspectRatio > 0);
  const [currentAspectRatio, setCurrentAspectRatio] = useState(defaultAspectRatio);

  /**
   * 初始化横纵比状态
   */
  useEffect(() => {
    if (open) {
      setLockAspectRatio(defaultAspectRatio > 0);
      setCurrentAspectRatio(defaultAspectRatio);
    }
  }, [open, defaultAspectRatio]);

  /**
   * 将 File 对象转换为 URL
   */
  useEffect(() => {
    if (!imageSrc) {
      setImageUrl("");
      setCropSize(null);
      return;
    }

    if (typeof imageSrc === "string") {
      setImageUrl(imageSrc);
      return;
    }

    // 对于 File 对象创建 URL，并在清理时释放
    const url = URL.createObjectURL(imageSrc);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageSrc]);

  /**
   * 监听裁剪框变化，实时更新尺寸信息
   */
  const handleCrop = useCallback(() => {
    if (!cropperRef.current) {
      return;
    }

    const cropper = cropperRef.current.cropper;
    const cropBoxData = cropper.getCropBoxData();

    // 计算实际输出尺寸（基于原始图片分辨率）
    const canvasData = cropper.getCanvasData();
    const scaleX = canvasData.naturalWidth / canvasData.width;
    const scaleY = canvasData.naturalHeight / canvasData.height;

    const actualWidth = Math.round(cropBoxData.width * scaleX);
    const actualHeight = Math.round(cropBoxData.height * scaleY);

    setCropSize({ width: actualWidth, height: actualHeight });
  }, []);

  /**
   * 切换锁定比例状态
   */
  const handleToggleLock = (checked: boolean) => {
    setLockAspectRatio(checked);

    if (!cropperRef.current) {
      return;
    }

    const cropper = cropperRef.current.cropper;

    if (checked) {
      // 锁定比例：使用当前或默认比例
      const ratio = currentAspectRatio || (16 / 9);
      cropper.setAspectRatio(ratio);
    } else {
      // 解锁比例：自由裁剪
      cropper.setAspectRatio(NaN);
    }
  };

  /**
   * 快速设置比例
   */
  const handleSetRatio = (ratio: number) => {
    setCurrentAspectRatio(ratio);
    setLockAspectRatio(true);

    if (!cropperRef.current) {
      return;
    }

    const cropper = cropperRef.current.cropper;
    cropper.setAspectRatio(ratio);
  };

  /**
   * 确认裁剪
   */
  const handleConfirm = async () => {
    if (!cropperRef.current) {
      return;
    }

    try {
      setLoading(true);
      const cropper = cropperRef.current.cropper;

      // 获取裁剪框数据
      const cropBoxData = cropper.getCropBoxData();

      // 计算实际输出尺寸（基于原始图片分辨率）
      const canvasData = cropper.getCanvasData();
      const scaleX = canvasData.naturalWidth / canvasData.width;
      const scaleY = canvasData.naturalHeight / canvasData.height;

      const outputWidth = Math.round(cropBoxData.width * scaleX);
      const outputHeight = Math.round(cropBoxData.height * scaleY);

      // 获取裁剪后的 canvas，使用实际尺寸
      const canvas = cropper.getCroppedCanvas({
        width: outputWidth,
        height: outputHeight,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      // 将 canvas 转换为 Blob
      canvas.toBlob(
        async (blob: Blob | null) => {
          if (blob) {
            await onConfirm(blob);
            onClose();
          } else {
            throw new Error("裁剪失败");
          }
        },
        "image/png",
        0.9
      );
    } catch (error) {
      console.error("裁剪失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 重置状态当弹窗关闭时
  useEffect(() => {
    if (!open) {
      setCropSize(null);
    }
  }, [open]);

  /**
   * 预设比例选项
   */
  const presetRatios = [
    { label: "自由", value: 0 },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "16:9", value: 16 / 9 },
    { label: "21:9", value: 21 / 9 },
  ];

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      width={700}
      footer={
        <Space>
          <Button onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button type="primary" onClick={handleConfirm} loading={loading}>
            确认裁剪
          </Button>
        </Space>
      }
      destroyOnHidden
      maskClosable={false}
      closable={true}
    >
      <div className="w-full">
        {imageUrl && (
          <>
            {/* 比例控制面板 */}
            {allowChangeAspectRatio && (
              <div className="mb-4 rounded border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 flex items-center justify-between">
                  <Text strong>裁剪比例</Text>
                  <Checkbox
                    checked={lockAspectRatio}
                    onChange={(e) => handleToggleLock(e.target.checked)}
                  >
                    锁定横纵比
                  </Checkbox>
                </div>
                <Space wrap>
                  {presetRatios.map((preset) => (
                    <Button
                      key={preset.label}
                      size="small"
                      type={currentAspectRatio === preset.value && lockAspectRatio ? "primary" : "default"}
                      onClick={() => handleSetRatio(preset.value)}
                      disabled={!lockAspectRatio}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Space>
              </div>
            )}

            {/* 裁剪器 */}
            <Cropper
              ref={cropperRef}
              src={imageUrl}
              style={{ height: 400, width: "100%" }}
              aspectRatio={lockAspectRatio ? (currentAspectRatio || NaN) : NaN}
              guides={true}
              background={false}
              responsive={true}
              restore={false}
              minCropBoxWidth={minCropBoxWidth}
              minCropBoxHeight={minCropBoxHeight}
              viewMode={1}
              dragMode="move"
              cropBoxMovable={true}
              cropBoxResizable={true}
              toggleDragModeOnDblclick={false}
              crop={handleCrop}
            />

            {/* 分辨率信息 */}
            {cropSize && (
              <Alert
                message={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">
                      裁剪后分辨率：
                      <Text strong className="ml-1">
                        {cropSize.width} × {cropSize.height}
                      </Text>
                    </Text>
                    {lockAspectRatio && currentAspectRatio > 0 && (
                      <Text type="secondary" className="text-xs">
                        比例：{currentAspectRatio === 1 ? "1:1（正方形）" :
                               currentAspectRatio === 16 / 9 ? "16:9（横向）" :
                               currentAspectRatio === 4 / 3 ? "4:3（横向）" :
                               currentAspectRatio === 21 / 9 ? "21:9（超宽）" :
                               `${currentAspectRatio.toFixed(2)}:1`}
                      </Text>
                    )}
                  </Space>
                }
                type="info"
                showIcon
                className="mt-4 mb-2"
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
