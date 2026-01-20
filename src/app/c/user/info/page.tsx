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
  Tag,
  Alert,
} from "antd";
import type { UploadProps } from "antd";
import {
  UserOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  EditOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import type { UserInfo } from "@/dto/user.dto";
import type { RcFile } from "antd/es/upload";
import ImageUpload from "@/components/ImageUpload";
import ImageCropper from "@/components/ImageCropper";
import WechatBindCard from "@/components/WechatBindCard";
import GithubBindCard from "@/components/GithubBindCard";
import LongTermTokenCard from "@/components/LongTermTokenCard";
import OAuthTokenCard from "@/components/OAuthTokenCard";
import { isAdmin } from "@/types/role";
import { RoleDisplayNames } from "@/types/role";

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
          form.setFieldsValue({
            nickname: data.nickname,
            mail: data.mail || "",
            phone: data.phone || "",
            avatar: data.avatar || "",
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
   * 处理头像区域快速编辑（点击头像编辑按钮）
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
   * 确认裁剪后上传（用于头像预览区域的快速编辑）
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

  return (
    <div className="w-full max-w-4xl mx-auto h-full overflow-y-auto">
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
                src={form.getFieldValue("avatar") || userInfo?.avatar}
              />
              <Upload
                beforeUpload={handleFileSelect}
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

          {/* 角色显示和权限说明 */}
          <div className="mb-6">
            <Space direction="vertical" size="middle" className="w-full">
              <div>
                <Text type="secondary">账户角色：</Text>
                <Tag
                  color={isAdmin(userInfo?.role) ? "red" : "blue"}
                  icon={<UserOutlined />}
                  className="ml-2"
                >
                  {RoleDisplayNames[userInfo?.role as keyof typeof RoleDisplayNames || "user"] || "未知"}
                </Tag>
              </div>
              {isAdmin(userInfo?.role) ? (
                <Alert
                  message="管理员权限"
                  description="您可以管理所有文章、合集、配置和用户"
                  type="success"
                  showIcon
                />
              ) : (
                <Alert
                  message="普通用户权限"
                  description="您可以创建和编辑自己的文章"
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </div>

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
              <ImageUpload
                placeholder="请输入头像URL（可选）"
                defaultAspectRatio={1}
              />
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

      {/* GitHub 绑定卡片 */}
      <div className="mt-6">
        <GithubBindCard
          isBound={!!userInfo?.github_id}
          githubUsername={userInfo?.github_username || undefined}
          onStatusChange={handleWechatStatusChange}
        />
      </div>

      {/* 长期Token管理 */}
      <div className="mt-6">
        <LongTermTokenCard userId={userInfo?.id?.toString()} />
      </div>

      {/* OAuth授权管理 */}
      <div className="mt-6">
        <OAuthTokenCard userId={userInfo?.id?.toString()} />
      </div>

      {/* 头像裁剪弹窗 */}
      <ImageCropper
        open={cropperVisible}
        imageSrc={selectedFile}
        onClose={handleCropperClose}
        onConfirm={handleCropperConfirm}
        defaultAspectRatio={1}
        minCropBoxWidth={100}
        minCropBoxHeight={100}
        title="编辑头像"
      />
    </div>
  );
}
