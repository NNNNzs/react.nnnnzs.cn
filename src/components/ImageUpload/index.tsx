/**
 * 通用图片上传组件
 * 支持 URL 输入、文件上传、图片裁剪
 * 兼容 Ant Design Form.Item
 *
 * 裁剪功能完全内聚，业务组件无需关心裁剪逻辑
 */

"use client";

import React, { useState } from "react";
import { Input, Upload, Button, Space, Image, message } from "antd";
import { UploadOutlined, DeleteOutlined, ScissorOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";
import ImageCropper from "@/components/ImageCropper";
import axios from "axios";
import "./index.css";

export interface ImageUploadProps {
  /** 当前图片 URL */
  value?: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示预览图，默认 true */
  showPreview?: boolean;
  /** 是否启用裁剪功能，默认 true */
  enableCrop?: boolean;
  /** 默认裁剪框宽高比（当启用裁剪时作为默认值），0 表示自由比例 */
  defaultAspectRatio?: number;
  /** 裁剪框最小宽度 */
  minCropBoxWidth?: number;
  /** 裁剪框最小高度 */
  minCropBoxHeight?: number;
  /** 最大文件大小（MB），默认 5 */
  maxSize?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外的样式类名 */
  className?: string;
  /** 裁剪弹窗标题 */
  cropperTitle?: string;
  /** 是否允许修改横纵比，默认 true */
  allowChangeAspectRatio?: boolean;
}

/**
 * 通用图片上传组件
 *
 * @example
 * ```tsx
 * // 基础用法
 * <Form.Item name="avatar" label="头像">
 *   <ImageUpload defaultAspectRatio={1} />
 * </Form.Item>
 *
 * // 背景图上传（16:9，允许修改比例）
 * <Form.Item name="cover" label="封面图">
 *   <ImageUpload defaultAspectRatio={16 / 9} />
 * </Form.Item>
 *
 * // 自由裁剪
 * <Form.Item name="banner" label="横幅">
 *   <ImageUpload defaultAspectRatio={0} />
 * </Form.Item>
 *
 * // 不支持裁剪，直接上传
 * <Form.Item name="logo" label="Logo">
 *   <ImageUpload enableCrop={false} />
 * </Form.Item>
 * ```
 */
export default function ImageUpload({
  value,
  onChange,
  placeholder = "请输入图片 URL 或点击上传",
  showPreview = true,
  enableCrop = true,
  defaultAspectRatio = 0,
  minCropBoxWidth = 50,
  minCropBoxHeight = 50,
  maxSize = 5,
  disabled = false,
  className,
  cropperTitle,
  allowChangeAspectRatio = true,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [loadingUrl, setLoadingUrl] = useState(false);

  /**
   * 处理 URL 输入变化
   */
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    onChange?.(url);
  };

  /**
   * 验证是否为有效的 URL
   */
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * 处理从 URL 加载图片
   */
  const handleLoadFromUrl = async () => {
    const url = value?.trim();

    if (!url) {
      message.warning("请先输入图片 URL");
      return;
    }

    if (!isValidUrl(url)) {
      message.error("请输入有效的 URL 地址");
      return;
    }

    setLoadingUrl(true);
    try {
      // 通过代理获取图片（避免 CORS 问题）
      const response = await fetch(`/api/fs/proxy-image?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        throw new Error("无法获取图片");
      }

      const blob = await response.blob();

      // 验证是否为图片
      if (!blob.type.startsWith("image/")) {
        throw new Error("URL 指向的不是图片文件");
      }

      // 验证文件大小
      const isLtMaxSize = blob.size / 1024 / 1024 < maxSize;
      if (!isLtMaxSize) {
        message.error(`图片大小不能超过 ${maxSize}MB！`);
        return;
      }

      // 转换为 File 对象
      const file = new File([blob], "image.png", { type: blob.type });

      if (enableCrop) {
        // 打开裁剪弹窗
        setSelectedFile(file);
        setSelectedUrl(url);
        setCropperVisible(true);
      } else {
        // 直接上传
        await handleUpload(file);
      }
    } catch (error) {
      console.error("加载图片失败:", error);
      message.error("无法加载图片，请检查 URL 是否正确");
    } finally {
      setLoadingUrl(false);
    }
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = (file: RcFile) => {
    // 验证文件类型
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return false;
    }

    // 验证文件大小
    const isLtMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLtMaxSize) {
      message.error(`图片大小不能超过 ${maxSize}MB！`);
      return false;
    }

    if (enableCrop) {
      // 打开裁剪弹窗
      setSelectedFile(file);
      setSelectedUrl("");
      setCropperVisible(true);
    } else {
      // 直接上传
      void handleUpload(file);
    }

    return false; // 阻止自动上传
  };

  /**
   * 上传文件到服务器
   */
  const handleUpload = async (file: File | Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("inputFile", file);

      const response = await axios.post<{
        status: boolean;
        data: string;
        message?: string;
      }>("/api/fs/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.status) {
        const url = response.data.data;
        onChange?.(url);
        message.success("上传成功");
      } else {
        message.error(response.data.message || "上传失败");
      }
    } catch (error) {
      console.error("上传失败:", error);
      message.error("上传失败");
    } finally {
      setUploading(false);
    }
  };

  /**
   * 确认裁剪后上传（内部处理，业务组件无需关心）
   */
  const handleCropperConfirm = async (blob: Blob) => {
    await handleUpload(blob);
    setCropperVisible(false);
    setSelectedFile(null);
    setSelectedUrl("");
  };

  /**
   * 关闭裁剪弹窗
   */
  const handleCropperClose = () => {
    setCropperVisible(false);
    setSelectedFile(null);
    setSelectedUrl("");
  };

  /**
   * 清空图片
   */
  const handleClear = () => {
    onChange?.("");
  };

  return (
    <div className={`image-upload-container ${className || ""}`}>
      <Space.Compact className="w-full">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={handleUrlChange}
          allowClear
          disabled={disabled || uploading}
          onPressEnter={handleLoadFromUrl}
        />
        {enableCrop && value && (
          <Button
            icon={<ScissorOutlined />}
            disabled={disabled || uploading || loadingUrl}
            onClick={handleLoadFromUrl}
            loading={loadingUrl}
          >
            裁剪
          </Button>
        )}
        <Upload
          beforeUpload={handleFileSelect}
          showUploadList={false}
          accept="image/*"
          disabled={disabled || uploading}
        >
          <Button
            icon={<UploadOutlined />}
            disabled={disabled || uploading}
            loading={uploading}
          >
            上传
          </Button>
        </Upload>
        {value && (
          <Button
            icon={<DeleteOutlined />}
            disabled={disabled || uploading}
            onClick={handleClear}
            danger
          >
            清除
          </Button>
        )}
      </Space.Compact>

      {/* 图片预览 */}
      {showPreview && value && (
        <div className="image-upload-preview">
          <Image
            src={value}
            alt="预览"
            width={200}
            style={{ maxWidth: "100%" }}
          />
        </div>
      )}

      {/* 裁剪弹窗（内部组件，业务层无需关心） */}
      {enableCrop && (
        <ImageCropper
          open={cropperVisible}
          imageSrc={selectedFile || selectedUrl}
          onClose={handleCropperClose}
          onConfirm={handleCropperConfirm}
          defaultAspectRatio={defaultAspectRatio}
          minCropBoxWidth={minCropBoxWidth}
          minCropBoxHeight={minCropBoxHeight}
          title={cropperTitle || "裁剪图片"}
          allowChangeAspectRatio={allowChangeAspectRatio}
        />
      )}
    </div>
  );
}
