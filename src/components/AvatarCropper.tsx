/**
 * 头像裁剪组件
 * 使用 react-cropper 实现图片裁剪功能
 */

"use client";

import React, { useRef, useState } from "react";
import { Modal, Button, Space } from "antd";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import type { ReactCropperElement } from "react-cropper";

interface AvatarCropperProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 图片源（File 对象或 URL） */
  imageSrc: string | File | null;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 确认裁剪回调，返回裁剪后的图片 Blob */
  onConfirm: (blob: Blob) => Promise<void>;
  /** 裁剪框的宽高比，默认为 1:1（正方形） */
  aspectRatio?: number;
  /** 裁剪框的最小尺寸 */
  minCropBoxWidth?: number;
  minCropBoxHeight?: number;
}

/**
 * 头像裁剪组件
 */
export default function AvatarCropper({
  open,
  imageSrc,
  onClose,
  onConfirm,
  aspectRatio = 1,
  minCropBoxWidth = 100,
  minCropBoxHeight = 100,
}: AvatarCropperProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");

  /**
   * 将 File 对象转换为 URL
   */
  React.useEffect(() => {
    if (!imageSrc) {
      setImageUrl("");
      return;
    }

    if (typeof imageSrc === "string") {
      setImageUrl(imageSrc);
    } else {
      const url = URL.createObjectURL(imageSrc);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [imageSrc]);

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

      // 获取裁剪后的 canvas
      const canvas = cropper.getCroppedCanvas({
        width: 400,
        height: 400,
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

  return (
    <Modal
      open={open}
      title="编辑头像"
      onCancel={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button type="primary" onClick={handleConfirm} loading={loading}>
            确认
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <div className="w-full">
        {imageUrl && (
          <Cropper
            ref={cropperRef}
            src={imageUrl}
            style={{ height: 400, width: "100%" }}
            aspectRatio={aspectRatio}
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
          />
        )}
      </div>
    </Modal>
  );
}
