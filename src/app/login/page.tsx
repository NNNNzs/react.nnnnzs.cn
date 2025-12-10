/**
 * 登录页
 */

'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

const { TabPane } = Tabs;

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [allowRegister, setAllowRegister] = useState(true);
  const [checkingConfig, setCheckingConfig] = useState(true);

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
   * 注册表单提交
   */
  const handleRegister = async (values: {
    account: string;
    password: string;
    nickname: string;
  }) => {
    try {
      setLoading(true);
      await register(values.account, values.password, values.nickname);
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

  // 显示加载状态
  if (checkingConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-purple-50 px-4 dark:from-slate-900 dark:to-slate-800">
      <Card
        className="w-full max-w-md shadow-xl"
        bordered={false}
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
            欢迎回来
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {allowRegister ? '登录或注册以继续' : '请登录以继续'}
          </p>
        </div>

        <Tabs defaultActiveKey="login" centered>
          {/* 登录表单 */}
          <TabPane tab="登录" key="login">
            <Form
              form={loginForm}
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              size="large"
            >
              <Form.Item
                name="account"
                rules={[{ required: true, message: '请输入账号！' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="账号"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码！' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
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
          </TabPane>

          {/* 注册表单 - 仅在允许注册时显示 */}
          {allowRegister && (
            <TabPane tab="注册" key="register">
              <Form
                form={registerForm}
                name="register"
                onFinish={handleRegister}
                autoComplete="off"
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
                  />
                </Form.Item>

                <Form.Item
                  name="nickname"
                  rules={[{ required: true, message: '请输入昵称！' }]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="昵称"
                  />
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
            </TabPane>
          )}
        </Tabs>
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

