/**
 * 用户信息编辑页面
 * 路由: /c/user/info
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Avatar,
  Space,
  Typography,
  Divider,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import {
  UserOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  EditOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import type { UserInfo } from "@/dto/user.dto";
import type { RcFile } from "antd/es/upload";
import AvatarCropper from "@/components/AvatarCropper";
import WechatBindCard from "@/components/WechatBindCard";

const { Title, Text } = Typography;

/**
 * 用户信息编辑页面组件
 */
export default function UserInfoPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /**
   * 加载用户信息
   */
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await axios.get("/api/user/info");
        if (response.data.status) {
          const data = response.data.data;
          setUserInfo(data);
          const avatar = data.avatar || "";
          setAvatarUrl(avatar);
          form.setFieldsValue({
            nickname: data.nickname,
            mail: data.mail || "",
            phone: data.phone || "",
            avatar: avatar,
          });
        } else {
          message.error(response.data.message || "获取用户信息失败");
        }
      } catch (error) {
        console.error("加载用户信息失败:", error);
        message.error("加载用户信息失败");
      }
    };

    loadUserInfo();
  }, [form]);

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await axios.put("/api/user/info", values);

      if (response.data.status) {
        message.success("更新成功");
        // 刷新用户信息
        await refreshUser();
        // 更新本地状态
        setUserInfo(response.data.data);
      } else {
        message.error(response.data.message || "更新失败");
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        console.error("更新用户信息失败:", error);
        message.error("更新失败");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 返回上一页
   */
  const handleGoBack = () => {
    router.back();
  };

  /**
   * 处理文件选择，打开裁剪弹窗
   */
  const handleFileSelect = (file: RcFile) => {
    // 验证文件类型
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return false;
    }

    // 验证文件大小
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error("图片大小不能超过 5MB！");
      return false;
    }

    setSelectedFile(file);
    setCropperVisible(true);
    return false; // 阻止自动上传
  };

  /**
   * 确认裁剪后上传
   */
  const handleCropperConfirm = async (blob: Blob) => {
    setUploading(true);
    try {
      // 将 Blob 转换为 File
      const file = new File([blob], "avatar.png", { type: "image/png" });
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
        setAvatarUrl(url);
        form.setFieldsValue({ avatar: url });
        message.success("头像上传成功");
      } else {
        message.error(response.data.message || "上传失败");
      }
    } catch (error) {
      console.error("头像上传失败:", error);
      message.error("头像上传失败");
    } finally {
      setUploading(false);
    }
  };

  /**
   * 关闭裁剪弹窗
   */
  const handleCropperClose = () => {
    setCropperVisible(false);
    setSelectedFile(null);
  };

  /**
   * 微信绑定状态变化回调
   */
  const handleWechatStatusChange = async () => {
    // 重新加载用户信息
    try {
      const response = await axios.get("/api/user/info");
      if (response.data.status) {
        const data = response.data.data;
        setUserInfo(data);
      }
    } catch (error) {
      console.error("刷新用户信息失败:", error);
    }
  };

  /**
   * 处理上传变化（已改为手动处理，此函数保留用于兼容）
   */
  const handleUploadChange: UploadProps["onChange"] = () => {
    // 文件选择后会在 handleFileSelect 中处理，这里不需要额外逻辑
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
            type="text"
          >
            返回
          </Button>
          <Title level={2} style={{ marginBottom: 0 }}>
            个人中心
          </Title>
        </div>
      </div>

      <Card>
        <Space orientation="vertical" size="large" className="w-full">
          {/* 用户头像预览和上传 */}
          <div className="flex items-center gap-6 pb-4">
            <div className="relative">
              <Avatar
                size={80}
                icon={<UserOutlined />}
                src={avatarUrl || userInfo?.avatar}
              />
              <Upload
                beforeUpload={handleFileSelect}
                onChange={handleUploadChange}
                showUploadList={false}
                accept="image/*"
                disabled={uploading}
              >
                <Button
                  type="primary"
                  shape="circle"
                  icon={<EditOutlined />}
                  size="small"
                  className="absolute -bottom-1 -right-1 shadow-md"
                  loading={uploading}
                  title="编辑头像"
                />
              </Upload>
            </div>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                {userInfo?.nickname || "未设置昵称"}
              </Title>
              <Text type="secondary">账号: {userInfo?.account}</Text>
            </div>
          </div>

          <Divider />

          {/* 用户信息表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="w-full"
          >
            <Form.Item
              label="昵称"
              name="nickname"
              rules={[
                { required: true, message: "请输入昵称" },
                { max: 16, message: "昵称最多16个字符" },
              ]}
            >
              <Input placeholder="请输入昵称" size="large" />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="mail"
              rules={[
                { type: "email", message: "请输入有效的邮箱地址" },
                { max: 30, message: "邮箱最多30个字符" },
              ]}
            >
              <Input placeholder="请输入邮箱（可选）" size="large" />
            </Form.Item>

            <Form.Item
              label="手机号"
              name="phone"
              rules={[
                {
                  pattern: /^1[3-9]\d{9}$/,
                  message: "请输入有效的手机号",
                },
                { max: 11, message: "手机号最多11位" },
              ]}
            >
              <Input placeholder="请输入手机号（可选）" size="large" />
            </Form.Item>

            <Form.Item
              label="头像URL"
              name="avatar"
              rules={[
                { type: "url", message: "请输入有效的URL地址" },
                { max: 255, message: "URL最多255个字符" },
              ]}
              help="可以上传图片或直接输入图片URL"
            >
              <Space.Compact className="w-full">
                <Input
                  placeholder="请输入头像URL（可选）"
                  size="large"
                  allowClear
                  value={avatarUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setAvatarUrl(url);
                    form.setFieldsValue({ avatar: url });
                  }}
                />
                <Upload
                  beforeUpload={handleFileSelect}
                  onChange={handleUploadChange}
                  showUploadList={false}
                  accept="image/*"
                  disabled={uploading}
                >
                  <Button
                    icon={<UploadOutlined />}
                    size="large"
                    loading={uploading}
                  >
                    上传图片
                  </Button>
                </Upload>
              </Space.Compact>
            </Form.Item>

            <Form.Item
              label="新密码"
              name="password"
              rules={[
                { min: 6, message: "密码至少6个字符" },
                { max: 20, message: "密码最多20个字符" },
              ]}
              help="留空则不修改密码"
            >
              <Input.Password
                autoComplete="off"
                placeholder="请输入新密码（留空则不修改）"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                  size="large"
                >
                  保存
                </Button>
                <Button onClick={() => form.resetFields()} size="large">
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </Card>

      {/* 微信绑定卡片 */}
      <div className="mt-6">
        <WechatBindCard
          isBound={!!userInfo?.wx_open_id}
          onStatusChange={handleWechatStatusChange}
        />
      </div>

      {/* 头像裁剪弹窗 */}
      <AvatarCropper
        open={cropperVisible}
        imageSrc={selectedFile}
        onClose={handleCropperClose}
        onConfirm={handleCropperConfirm}
        aspectRatio={1}
        minCropBoxWidth={100}
        minCropBoxHeight={100}
      />
    </div>
  );
}
