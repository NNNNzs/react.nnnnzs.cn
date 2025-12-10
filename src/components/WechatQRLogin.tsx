/**
 * 微信小程序扫码登录组件
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { message, Spin, Card } from 'antd';
import { QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

interface WechatQRLoginProps {
  /**
   * 登录成功回调
   * @param token 登录 token
   * @param userInfo 用户信息
   */
  onSuccess?: (token: string, userInfo: Record<string, unknown>) => void;
  
  /**
   * 环境版本
   * release: 正式版
   * trial: 体验版
   * develop: 开发版
   */
  env?: 'release' | 'trial' | 'develop';
}

/**
 * 微信小程序扫码登录组件
 */
export default function WechatQRLogin({ onSuccess, env = 'trial' }: WechatQRLoginProps) {
  const [token, setToken] = useState<string>('');
  const [imgSrc, setImgSrc] = useState<string>('');
  const [message_text, setMessageText] = useState<string>('请使用微信扫码登录');
  const [loading, setLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<{ nickName?: string; avatarUrl?: string } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取 token
   */
  const getToken = async (): Promise<string> => {
    try {
      const response = await axios.get('/api/wechat/getToken');
      if (response.data.status && response.data.data) {
        return response.data.data;
      }
      throw new Error('获取 token 失败');
    } catch (error) {
      console.error('获取 token 失败:', error);
      message.error('获取 token 失败');
      throw error;
    }
  };

  /**
   * 获取状态
   */
  const getStatus = async (currentToken: string) => {
    try {
      const response = await axios.get(`/api/wechat/status?token=${currentToken}`);
      if (response.data.status) {
        const status = response.data.data;
        
        if (status === 0) {
          setMessageText('扫码成功，请在手机上确认');
        } else if (status === 1) {
          setMessageText('确认成功，即将跳转登录');
          // 停止轮询
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // 获取用户信息
          await getUserInfo(currentToken);
        }
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  };

  /**
   * 获取用户信息
   */
  const getUserInfo = async (currentToken: string) => {
    try {
      const response = await axios.get(`/api/wechat/info?token=${currentToken}`);
      if (response.data.status && response.data.data) {
        const info = response.data.data;
        setUserInfo({
          nickName: info.nickName,
          avatarUrl: info.avatarUrl,
        });
        
        // 调用成功回调
        if (onSuccess && info.loginToken) {
          onSuccess(info.loginToken, info);
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      message.error('获取用户信息失败');
    }
  };

  /**
   * 初始化二维码
   */
  const initQRCode = async () => {
    try {
      setLoading(true);
      setMessageText('请使用微信扫码登录');
      setUserInfo(null);
      
      // 清除之前的轮询
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // 获取新的 token
      const newToken = await getToken();
      setToken(newToken);
      
      // 设置图片地址
      const imgUrl = `/api/wechat/getImg?token=${newToken}&env=${env}`;
      setImgSrc(imgUrl);
      
      setLoading(false);

      // 开始轮询状态
      timerRef.current = setInterval(() => {
        getStatus(newToken);
      }, 2000);
    } catch (error) {
      console.error('初始化二维码失败:', error);
      setLoading(false);
    }
  };

  /**
   * 组件挂载时初始化
   */
  useEffect(() => {
    initQRCode();

    // 组件卸载时清除定时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Card
            className="w-full max-w-sm"
            cover={
              <div className="flex items-center justify-center bg-gray-50 p-8 dark:bg-gray-800">
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt="微信扫码登录"
                    className="h-64 w-64 object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center">
                    <QrcodeOutlined className="text-6xl text-gray-300" />
                  </div>
                )}
              </div>
            }
          >
            <div className="text-center">
              <p className="mb-4 text-base text-gray-600 dark:text-gray-400">
                {message_text}
              </p>
              
              {userInfo && (
                <div className="mb-4">
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
            </div>
          </Card>
          
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>使用微信扫描二维码</p>
            <p>首次登录将自动注册账号</p>
          </div>
        </>
      )}
    </div>
  );
}
