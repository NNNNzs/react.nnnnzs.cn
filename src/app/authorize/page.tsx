'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Space, Typography, Alert, Spin, Select } from 'antd';
import { LockOutlined, UserOutlined, SafetyOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * OAuth 授权页面内容组件
 */
function AuthorizePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState<7 | 30 | 0>(7);
  
  // OAuth 参数
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const responseType = searchParams.get('response_type');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const scope = searchParams.get('scope') || 'read';

  /**
   * 检查用户登录状态
   */
  const checkLoginStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/user/info');
      if (response.data.status) {
        setIsLoggedIn(true);
      }
    } catch {
      setIsLoggedIn(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  /**
   * 处理用户登录
   */
  const handleLogin = async (values: { account: string; password: string }) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/login', {
        account: values.account,
        password: values.password
      });
      
      if (response.data.status) {
        setIsLoggedIn(true);
      } else {
        setError(response.data.message || '登录失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理用户授权
   */
  const handleAuthorize = async () => {
    if (!redirectUri || !clientId) {
      setError('缺少必需的 OAuth 参数');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/oauth/authorize', {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        scope: scope,
        approved: true,
        duration: duration
      });

      if (response.data.status) {
        // 重定向回 Claude CLI
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', response.data.data.code);
        if (state) redirectUrl.searchParams.set('state', state);
        
        window.location.href = redirectUrl.toString();
      } else {
        setError(response.data.message || '授权失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '授权失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 拒绝授权
   */
  const handleDeny = () => {
    if (redirectUri) {
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied authorization');
      if (state) redirectUrl.searchParams.set('state', state);
      
      window.location.href = redirectUrl.toString();
    }
  };

  if (checking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="检查登录状态..." />
      </div>
    );
  }

  // 验证必需的 OAuth 参数
  if (!clientId || !redirectUri || !responseType) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px'
      }}>
        <Card style={{ maxWidth: 500 }}>
          <Alert
            message="无效的授权请求"
            description="缺少必需的 OAuth 参数（client_id, redirect_uri, response_type）"
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          maxWidth: 450, 
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}
      >
        {!isLoggedIn ? (
          // 登录表单
          <>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <SafetyOutlined style={{ fontSize: 48, color: '#667eea' }} />
              <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>
                授权登录
              </Title>
              <Text type="secondary">
                {clientId} 请求访问您的账户
              </Text>
            </div>

            {error && (
              <Alert 
                message={error} 
                type="error" 
                closable 
                style={{ marginBottom: 20 }}
                onClose={() => setError('')}
              />
            )}

            <Form
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              size="large"
            >
              <Form.Item
                name="account"
                rules={[{ required: true, message: '请输入账号' }]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="账号/邮箱/手机号" 
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
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
                  block 
                  loading={loading}
                >
                  登录并授权
                </Button>
              </Form.Item>
            </Form>
          </>
        ) : (
          // 授权确认
          <>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <SafetyOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>
                授权确认
              </Title>
            </div>

            <Alert
              message="应用请求访问权限"
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text><strong>应用名称:</strong> {clientId}</Text>
                  <Text><strong>请求权限:</strong> {scope}</Text>
                  <Text><strong>回调地址:</strong> {redirectUri}</Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <ClockCircleOutlined /> 选择 Token 有效期
              </Text>
              <Select
                value={duration}
                onChange={(value) => setDuration(value)}
                style={{ width: '100%' }}
                size="large"
              >
                <Option value={7}>7天（默认推荐）</Option>
                <Option value={30}>1个月（30天）</Option>
                <Option value={0}>永久</Option>
              </Select>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                {duration === 7 ? '适合短期使用的标准选项' : duration === 30 ? '适合较长时间的使用场景' : '无限期有效，请妥善保管 Token'}
              </Text>
            </div>

            {error && (
              <Alert 
                message={error} 
                type="error" 
                closable 
                style={{ marginBottom: 20 }}
                onClose={() => setError('')}
              />
            )}

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                onClick={handleAuthorize}
              >
                授权访问
              </Button>
              <Button
                block
                size="large"
                onClick={handleDeny}
                disabled={loading}
              >
                拒绝授权
              </Button>
            </Space>
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * OAuth 授权页面（带Suspense包装）
 */
export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    }>
      <AuthorizePageContent />
    </Suspense>
  );
}
