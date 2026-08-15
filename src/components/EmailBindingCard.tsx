'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';
import { message, modal } from "@/components/AntdAppFeedbackBridge";
import { DisconnectOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';

interface EmailBindingCardProps {
  mail: string | null | undefined;
  verifiedAt: Date | string | null | undefined;
  onStatusChange: () => Promise<void> | void;
}

export default function EmailBindingCard({ mail, verifiedAt, onStatusChange }: EmailBindingCardProps) {
  const [form] = Form.useForm<{ email: string; code: string }>();
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!countdown) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const sendCode = async () => {
    try {
      const email = await form.validateFields(['email']).then((values) => values.email);
      setSending(true);
      const response = await axios.post('/api/user/email/send-code', { email });
      if (!response.data.status) throw new Error(response.data.message);
      message.success('验证码已发送，请查收邮箱');
      setCountdown(60);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const bind = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const response = await axios.put('/api/user/email', values);
      if (!response.data.status) throw new Error(response.data.message);
      message.success('邮箱绑定成功');
      form.resetFields();
      await onStatusChange();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '邮箱绑定失败');
    } finally {
      setSaving(false);
    }
  };

  const unbind = () => modal.confirm({
    title: '确认解绑邮箱',
    content: '解绑后将无法接收邮件提醒，也不能通过邮箱初始化快捷登录账号的密码。',
    okText: '确认解绑',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const response = await axios.delete('/api/user/email');
      if (!response.data.status) throw new Error(response.data.message);
      message.success('邮箱已解绑');
      await onStatusChange();
    },
  });

  return <Card title={<Space><MailOutlined />邮箱绑定</Space>}>
    <Space orientation="vertical" size="middle" className="w-full">
      {mail ? <div className="flex items-center justify-between gap-3">
        <div><Typography.Text strong>{mail}</Typography.Text><div className="mt-1 text-xs text-slate-500">{verifiedAt ? '可用于邮件提醒和账户安全验证' : '尚未完成验证'}</div></div>
        {verifiedAt ? <Tag color="success" icon={<SafetyCertificateOutlined />}>已验证</Tag> : <Tag>未验证</Tag>}
      </div> : <Alert type="info" showIcon title="尚未绑定邮箱" description="绑定邮箱后可接收邮件提醒，也可为快捷登录账号设置密码。" />}
      <Form form={form} layout="vertical" onFinish={bind}>
        <Form.Item label={mail ? '更换邮箱' : '绑定邮箱'} name="email" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }, { max: 30, message: '邮箱最多 30 个字符' }]}>
          <Input type="email" autoComplete="email" placeholder="请输入邮箱地址" />
        </Form.Item>
        <Form.Item label="邮箱验证码" name="code" rules={[{ required: true, message: '请输入验证码' }]}>
          <Input placeholder="请输入验证码" addonAfter={<Button type="link" size="small" loading={sending} disabled={countdown > 0} onClick={() => void sendCode()}>{countdown ? `${countdown}s 后重发` : '发送验证码'}</Button>} />
        </Form.Item>
        <Space><Button color="primary" variant="solid" htmlType="submit" loading={saving}>{mail ? '验证并更换' : '验证并绑定'}</Button>{mail ? <Button color="danger" icon={<DisconnectOutlined />} onClick={unbind}>解绑邮箱</Button> : null}</Space>
      </Form>
    </Space>
  </Card>;
}
