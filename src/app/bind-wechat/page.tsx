/**
 * 绑定微信页面
 */

'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, message, Spin } from 'antd';
import { QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

export default function BindWechatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [imgSrc, setImgSrc] = useState<string>('');
  const [message_text, setMessageText] = useState<string>('请使用微信扫码绑定');
  const [loading, setLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<{ nickName?: string; avatarUrl?: string } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const currentTokenRef = useRef<string>('');

  /**
   * 检查用户登录状态
   */
  useEffect(() => {
    if (!user) {
      message.warning('请先登录');
      router.push('/login');
    }
  }, [user, router]);

  /**
   * 获取 token（绑定场景）
   */
  const getToken = useCallback(async (): Promise<string> => {
    if (!user?.id) {
      throw new Error('用户未登录');
    }

    try {
      const response = await axios.get(`/api/wechat/getToken?action=bind&userId=${user.id}`);
      if (response.data.status && response.data.data) {
        return response.data.data.token;
      }
      throw new Error('获取 token 失败');
    } catch (error) {
      console.error('获取 token 失败:', error);
      message.error('获取 token 失败');
      throw error;
    }
  }, [user?.id]);

  /**
   * 获取状态
   */
  const getStatus = useCallback(async (currentToken: string) => {
    if (!isMountedRef.current || currentTokenRef.current !== currentToken) {
      return;
    }

    try {
      const response = await axios.get(`/api/wechat/status?token=${currentToken}`);
      if (response.data.status) {
        const data = response.data.data;

        if (data.scanStatus === 0) {
          setMessageText('扫码成功，请在手机上确认');
        } else if (data.scanStatus === 1 || data.status === 1) {
          setMessageText('绑定成功！');
          // 停止轮询
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (isMountedRef.current && currentTokenRef.current === currentToken) {
            setUserInfo({
              nickName: data.scanData?.nickName,
              avatarUrl: data.scanData?.avatarUrl,
            });

            message.success('微信绑定成功');

            // 延迟跳转
            setTimeout(() => {
              router.push('/c/profile');
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  }, [router]);

  /**
   * 初始化二维码
   */
  const initQRCode = useCallback(async () => {
    if (!isMountedRef.current || !user?.id) {
      return;
    }

    try {
      setLoading(true);
      setMessageText('请使用微信扫码绑定');
      setUserInfo(null);

      // 清除之前的轮询
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 获取新的 token
      const newToken = await getToken();

      if (!isMountedRef.current) {
        return;
      }

      currentTokenRef.current = newToken;

      // 设置图片地址
      const imgUrl = `/api/wechat/getImg?token=${newToken}&env=release`;
      setImgSrc(imgUrl);

      setLoading(false);

      // 开始轮询状态
      if (isMountedRef.current && currentTokenRef.current === newToken) {
        timerRef.current = setInterval(() => {
          if (isMountedRef.current && currentTokenRef.current === newToken) {
            getStatus(newToken);
          } else {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, 2000);
      }

      // 5分钟后停止轮询
      setTimeout(() => {
        if (timerRef.current && isMountedRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setMessageText('二维码已过期，请刷新');
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('初始化二维码失败:', error);
      if (isMountedRef.current) {
        setLoading(false);
        setMessageText('生成二维码失败，请重试');
      }
    }
  }, [getStatus, getToken, user?.id]);

  /**
   * 组件挂载时初始化
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    isMountedRef.current = true;
    currentTokenRef.current = '';

    void initQRCode();

    return () => {
      isMountedRef.current = false;
      currentTokenRef.current = '';
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user?.id, initQRCode]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-slate-900">
      <Card
        className="w-full max-w-md shadow-xl"
        title="绑定微信"
      >
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : (
            <>
              {imgSrc ? (
                <div className="mb-4 flex items-center justify-center bg-gray-50 p-8 dark:bg-gray-800">
                  <img
                    src={imgSrc}
                    alt="绑定微信"
                    className="h-64 w-64 object-contain"
                  />
                </div>
              ) : (
                <div className="mb-4 flex h-64 w-64 items-center justify-center">
                  <QrcodeOutlined className="text-6xl text-gray-300" />
                </div>
              )}

              <p className="mb-4 text-center text-base text-gray-600 dark:text-gray-400">
                {message_text}
              </p>

              {userInfo && (
                <div className="mb-4 text-center">
                  <p className="text-lg font-semibold">{userInfo.nickName}</p>
                  {userInfo.avatarUrl && (
                    <img
                      src={userInfo.avatarUrl}
                      alt="头像"
                      className="mx-auto mt-2 h-16 w-16 rounded-full"
                    />
                  )}
                </div>
              )}

              <button
                onClick={initQRCode}
                className="flex items-center justify-center gap-2 rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              >
                <ReloadOutlined />
                刷新二维码
              </button>

              <div className="mt-4 text-center text-sm text-gray-500">
                <p>使用微信扫描二维码</p>
                <p>扫码后确认即可绑定微信</p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
