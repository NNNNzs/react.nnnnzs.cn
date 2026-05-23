/**
 * 登录页
 */

'use client';

import React, { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, WechatOutlined, GithubOutlined, ScanOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import WechatQRLogin from '@/components/WechatQRLogin';

// face-api 依赖浏览器 API，必须禁用 SSR
const FaceCamera = dynamic(() => import('@/components/FaceCamera'), { ssr: false });

/** Token Cookie 名称，与服务端保持一致 */
const TOKEN_KEY = 'blog-token';

/** 邮箱验证 API 基地址 */
const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [allowRegister, setAllowRegister] = useState(true);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  /**
   * 检查是否允许注册
   */
  useEffect(() => {
    const checkRegisterConfig = async () => {
      try {
        const response = await axios.get('/api/config/key/allow_register');
        if (response.data.status && response.data.data) {
          const config = response.data.data;
          setAllowRegister(config.status === 1 && config.value === '1');
        } else {
          // 如果没有配置，默认不允许注册
          setAllowRegister(false);
        }
      } catch (error) {
        console.error('检查注册配置失败:', error);
        // 出错时默认不允许注册
        setAllowRegister(false);
      } finally {
        setCheckingConfig(false);
      }
    };

    checkRegisterConfig();
  }, []);

  /**
   * 登录表单提交
   */
  const handleLogin = async (values: { account: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.account, values.password);
      message.success('登录成功！');
      
      // 跳转到来源页面或管理后台
      const redirect = searchParams.get('redirect') || '/c';
      router.push(redirect);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '登录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 发送邮箱验证码
   */
  const handleSendCode = async () => {
    try {
      const email = registerForm.getFieldValue('email');
      if (!email) {
        message.warning('请先输入邮箱地址');
        return;
      }

      // 邮箱格式校验
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        message.warning('邮箱格式不正确');
        return;
      }

      const response = await axios.post(`${EMAIL_API}/email/send-code`, {
        email,
        purpose: 'register',
      });

      if (response.data.status) {
        message.success('验证码已发送，请查收邮箱');
        // 开始 60 秒倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        message.error(response.data.message || '发送失败');
      }
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message || '发送失败'
        : '发送失败';
      message.error(msg);
    }
  };

  /**
   * 注册表单提交
   */
  const handleRegister = async (values: {
    account: string;
    password: string;
    nickname: string;
    email: string;
    emailCode: string;
  }) => {
    try {
      setLoading(true);
      await register(values.account, values.password, values.nickname, values.email, values.emailCode);
      message.success('注册成功！');

      // 跳转到首页
      router.push('/');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '注册失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 微信扫码登录成功回调
   */
  const handleWechatLoginSuccess = async (token: string) => {
    try {
      // 使用 token 获取用户信息并设置到 context
      const response = await axios.get('/api/user/info', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.data.status && response.data.data) {
        // 存储 token 到 cookie（使用正确的 cookie 名称）
        document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=2592000`; // 30 天
        
        // 刷新 AuthContext 中的用户状态
        await refreshUser();
        
        message.success('微信登录成功！');
        
        // 跳转到来源页面或管理后台
        const redirect = searchParams.get('redirect') || '/c';
        router.push(redirect);
      }
    } catch (error) {
      console.error('微信登录失败:', error);
      message.error('微信登录失败，请重试');
    }
  };

  /**
   * GitHub 登录
   */
  const handleGithubLogin = () => {
    const redirect = searchParams.get('redirect') || '/c';
    window.location.href = `/api/github/auth?action=login&redirect=${encodeURIComponent(redirect)}`;
  };

  /**
   * 人脸登录拍照回调
   */
  const handleFaceCapture = async (base64: string) => {
    setFaceCaptured(base64);
    setFaceLoading(true);
    try {
      const response = await axios.post('/api/face/login', { image: base64 });
      if (response.data.status) {
        const { token } = response.data.data;
        document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;
        await refreshUser();
        message.success('人脸登录成功！');
        const redirect = searchParams.get('redirect') || '/c';
        router.push(redirect);
      } else {
        message.error(response.data.message || '人脸识别失败');
        setFaceCaptured(null);
      }
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : '人脸识别失败';
      message.error(msg || '人脸识别失败');
      setFaceCaptured(null);
    } finally {
      setFaceLoading(false);
    }
  };

  // 显示加载状态
  if (checkingConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  const items = [
    {
      key: 'login',
      label: (
        <span>
          <UserOutlined />
          账号登录
        </span>
      ),
      children: (
        <Form
          form={loginForm}
          name="login"
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="account"
            rules={[{ required: true, message: '请输入账号！' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="账号"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码！' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="w-full"
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>

          <div className="text-center text-sm text-slate-500">
            测试账号: admin / admin123
          </div>
        </Form>
      ),
    },
    {
      key: 'wechat',
      label: (
        <span>
          <WechatOutlined />
          微信登录
        </span>
      ),
      children: (
        <WechatQRLogin 
          onSuccess={handleWechatLoginSuccess}
          env="release"
        />
      ),
    },
    {
      key: 'github',
      label: (
        <span>
          <GithubOutlined />
          GitHub
        </span>
      ),
      children: (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-6 text-center">
            <GithubOutlined className="text-6xl text-gray-700 dark:text-gray-300" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              使用 GitHub 账号登录
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<GithubOutlined />}
            onClick={handleGithubLogin}
            className="w-full"
          >
            使用 GitHub 登录
          </Button>
        </div>
      ),
    },
    {
      key: 'face',
      label: (
        <span>
          <ScanOutlined />
          人脸登录
        </span>
      ),
      children: (
        <div className="flex flex-col items-center py-4">
          {faceLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="text-lg text-blue-600">识别中...</div>
              <p className="text-sm text-gray-500">正在验证人脸信息</p>
            </div>
          ) : (
            <>
              <FaceCamera
                onCapture={handleFaceCapture}
                width={280}
                height={280}
              />
              <p className="mt-3 text-center text-sm text-gray-500">
                请将面部对准引导框后点击拍照
              </p>
            </>
          )}
        </div>
      ),
    },
    ...(allowRegister
      ? [
          {
            key: 'register',
            label: (
              <span>
                <UserOutlined />
                注册
              </span>
            ),
            children: (
              <Form
                form={registerForm}
                name="register"
                onFinish={handleRegister}
                size="large"
              >
                <Form.Item
                  name="account"
                  rules={[
                    { required: true, message: '请输入账号！' },
                    { min: 3, message: '账号至少3个字符！' },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="账号"
                    autoComplete="username"
                  />
                </Form.Item>

                <Form.Item
                  name="nickname"
                  rules={[{ required: true, message: '请输入昵称！' }]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="昵称"
                    autoComplete="nickname"
                  />
                </Form.Item>

                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱！' },
                    { type: 'email', message: '邮箱格式不正确！' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="邮箱"
                    type="email"
                    autoComplete="email"
                  />
                </Form.Item>

                <Form.Item
                  name="emailCode"
                  rules={[
                    { required: true, message: '请输入验证码！' },
                    { len: 6, message: '验证码为6位数字！' },
                  ]}
                >
                  <div className="flex gap-2">
                    <Input
                      prefix={<SafetyOutlined />}
                      placeholder="邮箱验证码"
                      className="flex-1"
                      maxLength={6}
                    />
                    <Button
                      onClick={handleSendCode}
                      disabled={countdown > 0}
                      className="shrink-0"
                      style={{ minWidth: 120 }}
                    >
                      {countdown > 0 ? `${countdown}s` : '发送验证码'}
                    </Button>
                  </div>
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: '请输入密码！' },
                    { min: 6, message: '密码至少6个字符！' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: '请确认密码！' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('两次密码不一致！'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="确认密码"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    className="w-full"
                    loading={loading}
                  >
                    注册
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-purple-50 px-4 dark:from-slate-900 dark:to-slate-800">
      <Card
        className="w-full max-w-md shadow-xl"
        variant="borderless"
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
            欢迎回来
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {allowRegister ? '登录或注册以继续' : '请登录以继续'}
          </p>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          centered
          items={items}
        />
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

