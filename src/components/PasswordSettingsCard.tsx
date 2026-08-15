'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { message } from "@/components/AntdAppFeedbackBridge";
import { LockOutlined } from '@ant-design/icons';
import axios from 'axios';

interface PasswordSettingsCardProps {
  hasPassword: boolean;
  hasVerifiedMail: boolean;
  onStatusChange: () => Promise<void> | void;
}

export default function PasswordSettingsCard({ hasPassword, hasVerifiedMail, onStatusChange }: PasswordSettingsCardProps) {
  const [form] = Form.useForm<{ currentPassword?: string; newPassword: string; confirmPassword: string; emailCode?: string }>();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!countdown) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const sendCode = async () => {
    try {
      setSending(true);
      const response = await axios.post('/api/user/password/send-code');
      if (!response.data.status) throw new Error(response.data.message);
      message.success('验证码已发送，请查收邮箱');
      setCountdown(60);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '验证码发送失败');
    } finally { setSending(false); }
  };
  const submit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const response = await axios.put('/api/user/password', values);
      if (!response.data.status) throw new Error(response.data.message);
      message.success(hasPassword ? '密码修改成功' : '登录密码设置成功');
      form.resetFields();
      await onStatusChange();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '密码设置失败');
    } finally { setLoading(false); }
  };

  return <Card title={<Space><LockOutlined />登录密码</Space>}>
    <Space orientation="vertical" size="middle" className="w-full">
      <Typography.Text type="secondary">{hasPassword ? '修改密码前需要确认当前密码。' : '当前账户通过快捷登录访问，设置密码后即可使用账号密码登录。'}</Typography.Text>
      {!hasPassword && !hasVerifiedMail ? <Alert type="warning" showIcon title="请先绑定并验证邮箱" description="为了确认账户归属，快捷登录账户需先完成邮箱验证才能设置密码。" /> : null}
      <Form form={form} layout="vertical" onFinish={submit} disabled={!hasPassword && !hasVerifiedMail}>
        {hasPassword ? <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true, message: '请输入当前密码' }]}><Input.Password autoComplete="current-password" /></Form.Item> : <Form.Item label="邮箱验证码" name="emailCode" rules={[{ required: true, message: '请输入邮箱验证码' }]}><Input addonAfter={<Button type="link" size="small" disabled={countdown > 0} loading={sending} onClick={() => void sendCode()}>{countdown ? `${countdown}s 后重发` : '发送验证码'}</Button>} /></Form.Item>}
        <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 个字符' }, { max: 20, message: '密码最多 20 个字符' }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item label="确认新密码" name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true, message: '请确认新密码' }, ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')) })]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Button color="primary" variant="solid" htmlType="submit" loading={loading}>{hasPassword ? '修改密码' : '设置登录密码'}</Button>
      </Form>
    </Space>
  </Card>;
}
