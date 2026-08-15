/** 个人设置页面，路由：/c/user/info */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Form, Input, Space, Tabs, Tag, Typography, Upload } from 'antd';
import { message } from "@/components/AntdAppFeedbackBridge";
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { RcFile } from 'antd/es/upload';
import { useAuth } from '@/contexts/AuthContext';
import type { UserInfo } from '@/dto/user.dto';
import { IMAGE_VIEW, TTS_VIEW } from '@/constants/permissions';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import MediaUpload from '@/components/MediaUpload';
import { FILE_UPLOAD_TIMEOUT_MS } from '@/constants/upload';
import ImageCropper from '@/components/ImageCropper';
import EmailBindingCard from '@/components/EmailBindingCard';
import PasswordSettingsCard from '@/components/PasswordSettingsCard';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import TaskNotificationSettings from '@/components/task-notifications/TaskNotificationSettings';
import WechatBindCard from '@/components/WechatBindCard';
import GithubBindCard from '@/components/GithubBindCard';
import FaceRegistrationCard from '@/components/FaceRegistrationCard';
import LongTermTokenCard from '@/components/LongTermTokenCard';
import OAuthTokenCard from '@/components/OAuthTokenCard';

type ProfileValues = { nickname: string; phone?: string; avatar?: string };

export default function UserInfoPage() {
  const router = useRouter();
  const { refreshUser, hasPermission } = useAuth();
  const [form] = Form.useForm<ProfileValues>();
  const avatar = Form.useWatch('avatar', form);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [initialValues, setInitialValues] = useState<ProfileValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropperVisible, setCropperVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadUserInfo = useCallback(async () => {
    try {
      const response = await axios.get('/api/user/info', { headers: { 'Cache-Control': 'no-store' } });
      if (!response.data.status) throw new Error(response.data.message || '获取用户信息失败');
      const data = response.data.data as UserInfo;
      const values = { nickname: data.nickname, phone: data.phone || '', avatar: data.avatar || '' };
      setUserInfo(data);
      setInitialValues(values);
      form.setFieldsValue(values);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取用户信息失败');
    }
  }, [form]);

  useEffect(() => { void loadUserInfo(); }, [loadUserInfo]);

  const refreshSettings = useCallback(async () => {
    await Promise.all([loadUserInfo(), refreshUser()]);
  }, [loadUserInfo, refreshUser]);

  const submitProfile = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const response = await axios.put('/api/user/info', values);
      if (!response.data.status) throw new Error(response.data.message || '保存失败');
      message.success('基本资料已保存');
      await refreshSettings();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally { setLoading(false); }
  };

  const selectFile = (file: RcFile) => {
    if (!file.type.startsWith('image/')) { message.error('只能上传图片文件'); return false; }
    if (file.size / 1024 / 1024 >= 10) { message.error('图片大小不能超过 10MB'); return false; }
    setSelectedFile(file);
    setCropperVisible(true);
    return false;
  };

  const confirmCrop = async (blob: Blob) => {
    try {
      setUploading(true);
      const data = new FormData();
      data.append('inputFile', new File([blob], 'avatar.png', { type: 'image/png' }));
      const response = await axios.post('/api/fs/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: FILE_UPLOAD_TIMEOUT_MS,
      });
      if (!response.data.status) throw new Error(response.data.message || '上传失败');
      form.setFieldValue('avatar', response.data.data);
      message.success('头像上传成功，保存基本资料后生效');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '头像上传失败');
    } finally { setUploading(false); }
  };

  const hasTaskNotifications = hasPermission(IMAGE_VIEW) || hasPermission(TTS_VIEW);
  const hasVerifiedMail = Boolean(userInfo?.mail && userInfo?.mail_verified_at);

  return <div className="w-full max-w-4xl mx-auto h-full overflow-y-auto">
    <AdminPageHeader title="个人设置" extra={<Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} variant="text" size="small">返回</Button>} />
    <Tabs items={[
      { key: 'profile', label: '基本资料', children: <Card loading={!userInfo}>
        <Space orientation="vertical" size="large" className="w-full">
          <div className="flex items-center gap-6"><div className="relative"><Avatar size={80} icon={<UserOutlined />} src={avatar || userInfo?.avatar} /><Upload beforeUpload={selectFile} showUploadList={false} accept="image/*" disabled={uploading}><Button variant="solid" color="primary" shape="circle" icon={<EditOutlined />} size="small" className="absolute -bottom-1 -right-1 shadow-md" loading={uploading} /></Upload></div><div><Typography.Text strong className="block text-base">{userInfo?.nickname || '未设置昵称'}</Typography.Text><Typography.Text type="secondary">账号：{userInfo?.account}</Typography.Text></div></div>
          <Form form={form} layout="vertical" onFinish={submitProfile}><Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请输入昵称' }, { max: 16, message: '昵称最多 16 个字符' }]}><Input autoComplete="nickname" /></Form.Item><Form.Item label="手机号" name="phone" rules={[{ pattern: /^$|^1[3-9]\d{9}$/, message: '请输入有效的手机号' }]}><Input autoComplete="tel" /></Form.Item><Form.Item label="头像" name="avatar" rules={[{ type: 'url', message: '请输入有效的 URL 地址' }, { max: 255, message: 'URL 最多 255 个字符' }]} help="可上传图片或直接输入图片 URL"><MediaUpload placeholder="请输入头像 URL" defaultAspectRatio={1} /></Form.Item><Space><Button color="primary" variant="solid" htmlType="submit" icon={<SaveOutlined />} loading={loading}>保存</Button><Button onClick={() => initialValues && form.setFieldsValue(initialValues)}>重置</Button></Space></Form>
        </Space>
      </Card> },
      { key: 'security', label: '账户与安全', children: <Space orientation="vertical" size="middle" className="w-full"><Card><Space orientation="vertical"><div><Typography.Text type="secondary">账户角色：</Typography.Text><Space wrap>{userInfo?.roles.map((role) => <Tag key={role.id}>{role.name}</Tag>)}</Space></div><Typography.Text type="secondary">账号：{userInfo?.account}</Typography.Text></Space></Card><EmailBindingCard mail={userInfo?.mail} verifiedAt={userInfo?.mail_verified_at} onStatusChange={refreshSettings} /><PasswordSettingsCard hasPassword={Boolean(userInfo?.has_password)} hasVerifiedMail={hasVerifiedMail} onStatusChange={refreshSettings} /></Space> },
      { key: 'notifications', label: '通知设置', children: <Space orientation="vertical" size="middle" className="w-full"><NotificationSettingsCard hasVerifiedMail={hasVerifiedMail} />{hasTaskNotifications ? <TaskNotificationSettings /> : null}</Space> },
      { key: 'login', label: '登录方式', children: <Space orientation="vertical" size="middle" className="w-full"><WechatBindCard isBound={Boolean(userInfo?.wx_open_id)} onStatusChange={refreshSettings} /><GithubBindCard isBound={Boolean(userInfo?.github_id)} githubUsername={userInfo?.github_username || undefined} onStatusChange={refreshSettings} /><FaceRegistrationCard onStatusChange={refreshSettings} /></Space> },
      { key: 'tokens', label: '开发者凭据', children: <Space orientation="vertical" size="middle" className="w-full"><LongTermTokenCard userId={userInfo?.id?.toString()} /><OAuthTokenCard userId={userInfo?.id?.toString()} /></Space> },
    ]} />
    <ImageCropper open={cropperVisible} imageSrc={selectedFile} onClose={() => { setCropperVisible(false); setSelectedFile(null); }} onConfirm={confirmCrop} defaultAspectRatio={1} minCropBoxWidth={100} minCropBoxHeight={100} title="编辑头像" />
  </div>;
}
