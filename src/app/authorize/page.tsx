'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Form, Input, Button, Typography, Alert, Spin, Select } from 'antd';
import { SafetyOutlined, UserOutlined, LockOutlined, ClockCircleOutlined, CheckOutlined, RightOutlined } from '@ant-design/icons';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '@/hooks/useDarkMode';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * OAuth 授权页面内容组件
 */
function AuthorizePageContent() {
  const searchParams = useSearchParams();
  const { isDark, toggleDark } = useDarkMode();
  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState<7 | 30 | 0>(7);
  const [customAppName, setCustomAppName] = useState('');

  // OAuth 参数
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const responseType = searchParams.get('response_type');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const scope = searchParams.get('scope') || 'read';

  // 使用自定义名称或回退到 clientId
  const displayName = customAppName.trim() || clientId;

  // 避免水合不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

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
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '登录失败';
      setError(errorMessage);
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
        duration: duration,
        app_name: customAppName.trim() || null // 传递自定义应用名称
      });

      if (response.data.status) {
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', response.data.data.code);
        if (state) redirectUrl.searchParams.set('state', state);

        window.location.href = redirectUrl.toString();
      } else {
        setError(response.data.message || '授权失败');
      }
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '授权失败';
      setError(errorMessage);
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

  if (!mounted) {
    return null;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">检查登录状态...</p>
        </div>
      </div>
    );
  }

  // 验证必需的 OAuth 参数
  if (!clientId || !redirectUri || !responseType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 rounded-2xl p-6 max-w-md backdrop-blur-xl">
          <Alert
            message="无效的授权请求"
            description="缺少必需的 OAuth 参数（client_id, redirect_uri, response_type）"
            type="error"
            showIcon
          />
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* 网格背景 */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* 主题切换按钮 */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        onClick={toggleDark}
        className="absolute top-6 right-6 p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors z-20"
        aria-label="切换主题"
      >
        <span className="material-symbols-outlined dark:hidden text-slate-700">dark_mode</span>
        <span className="material-symbols-outlined hidden dark:block text-amber-500">light_mode</span>
      </motion.button>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* 主卡片 */}
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {!isLoggedIn ? (
              // 登录表单
              <motion.div
                key="login"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* 头部图标 */}
                <motion.div
                  className="flex justify-center mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-40 dark:opacity-50 animate-pulse" />
                    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                      <SafetyOutlined className="text-3xl text-cyan-500 dark:text-cyan-400" />
                    </div>
                  </div>
                </motion.div>

                {/* 标题 */}
                <div className="text-center mb-8">
                  <Title level={3} className="text-slate-800 dark:text-white text-2xl font-semibold mb-2">
                    授权登录
                  </Title>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm">
                    {displayName} 请求访问您的账户
                  </Text>
                </div>

                {/* 自定义应用名称输入 */}
                <div className="mb-6">
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-2">
                    自定义应用名称（可选）
                  </label>
                  <Input
                    value={customAppName}
                    onChange={(e) => setCustomAppName(e.target.value)}
                    placeholder="输入易记的应用名称"
                    className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl h-11"
                  />
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                    当前显示: <span className="text-cyan-600 dark:text-cyan-400 font-medium">{displayName}</span>
                  </p>
                </div>

                {/* 错误提示 */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4"
                    >
                      <Alert
                        message={error}
                        type="error"
                        closable
                        onClose={() => setError('')}
                        className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 登录表单 */}
                <Form
                  name="login"
                  onFinish={handleLogin}
                  autoComplete="off"
                  layout="vertical"
                  requiredMark={false}
                >
                  <Form.Item
                    label={<span className="text-slate-700 dark:text-slate-300">账号</span>}
                    name="account"
                    rules={[{ required: true, message: '请输入账号' }]}
                  >
                    <Input
                      prefix={<UserOutlined className="text-slate-400 dark:text-slate-500" />}
                      placeholder="账号/邮箱/手机号"
                      className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl h-11"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-slate-700 dark:text-slate-300">密码</span>}
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="text-slate-400 dark:text-slate-500" />}
                      placeholder="密码"
                      className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl h-11"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item className="mb-0">
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      size="large"
                      className="h-12 bg-gradient-to-r from-blue-600 to-cyan-600 border-0 rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                      {loading ? '登录中...' : '登录并授权'}
                    </Button>
                  </Form.Item>
                </Form>
              </motion.div>
            ) : (
              // 授权确认
              <motion.div
                key="authorize"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* 成功图标 */}
                <motion.div
                  className="flex justify-center mb-6"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-xl opacity-40 dark:opacity-50" />
                    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 rounded-full border border-slate-200 dark:border-white/10">
                      <SafetyOutlined className="text-3xl text-green-500 dark:text-green-400" />
                    </div>
                  </div>
                </motion.div>

                {/* 标题 */}
                <div className="text-center mb-6">
                  <Title level={3} className="text-slate-800 dark:text-white text-2xl font-semibold mb-2">
                    授权确认
                  </Title>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm">
                    请确认是否授予以下权限
                  </Text>
                </div>

                {/* 应用信息卡片 */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-white/10 mb-5">
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mr-3 shrink-0">
                        <SafetyOutlined className="text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">应用名称</p>
                        <p className="text-slate-800 dark:text-white font-medium truncate">{displayName}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mr-3 shrink-0">
                        <CheckOutlined className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">请求权限</p>
                        <p className="text-slate-800 dark:text-white font-medium">{scope}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mr-3 shrink-0">
                        <RightOutlined className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">回调地址</p>
                        <p className="text-slate-800 dark:text-white font-medium text-xs break-all">{redirectUri}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token 有效期选择 */}
                <div className="mb-5">
                  <div className="flex items-center mb-3">
                    <ClockCircleOutlined className="text-slate-400 dark:text-slate-500 mr-2" />
                    <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Token 有效期</span>
                  </div>
                  <Select
                    value={duration}
                    onChange={(value) => setDuration(value)}
                    className="w-full"
                    size="large"
                    suffixIcon={<RightOutlined />}
                  >
                    <Option value={7}>
                      <div className="flex items-center justify-between">
                        <span>7 天</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-4">默认推荐</span>
                      </div>
                    </Option>
                    <Option value={30}>
                      <div className="flex items-center justify-between">
                        <span>30 天</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-4">较长时间</span>
                      </div>
                    </Option>
                    <Option value={0}>
                      <div className="flex items-center justify-between">
                        <span>永久</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-4">无限期</span>
                      </div>
                    </Option>
                  </Select>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                    {duration === 7 ? '适合短期使用的标准选项' : duration === 30 ? '适合较长时间的使用场景' : '无限期有效，请妥善保管 Token'}
                  </p>
                </div>

                {/* 错误提示 */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4"
                    >
                      <Alert
                        message={error}
                        type="error"
                        closable
                        onClose={() => setError('')}
                        className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 操作按钮 */}
                <div className="space-y-3">
                  <Button
                    type="primary"
                    block
                    size="large"
                    loading={loading}
                    onClick={handleAuthorize}
                    className="h-12 bg-gradient-to-r from-green-600 to-emerald-600 border-0 rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    {loading ? '授权中...' : '授权访问'}
                  </Button>
                  <Button
                    block
                    size="large"
                    onClick={handleDeny}
                    disabled={loading}
                    className="h-12 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    拒绝授权
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部说明 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            授权后，该应用将能够访问您的账户数据
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * OAuth 授权页面（带Suspense包装）
 */
export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    }>
      <AuthorizePageContent />
    </Suspense>
  );
}
