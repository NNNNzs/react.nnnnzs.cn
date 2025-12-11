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
  const isMountedRef = useRef<boolean>(true);
  const currentTokenRef = useRef<string>('');
  const initRef = useRef<number>(0);

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
    // 如果 token 已经改变或者是旧实例，不执行
    if (!isMountedRef.current || currentTokenRef.current !== currentToken) {
      return;
    }
    
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
          if (isMountedRef.current && currentTokenRef.current === currentToken) {
            await getUserInfo(currentToken);
          }
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
    // 如果 token 已经改变或者是旧实例，不执行
    if (!isMountedRef.current || currentTokenRef.current !== currentToken) {
      return;
    }
    
    try {
      const response = await axios.get(`/api/wechat/info?token=${currentToken}`);
      if (response.data.status && response.data.data) {
        const info = response.data.data;
        
        // 再次检查是否还是当前的 token 实例
        if (isMountedRef.current && currentTokenRef.current === currentToken) {
          setUserInfo({
            nickName: info.nickName,
            avatarUrl: info.avatarUrl,
          });
          
          // 调用成功回调
          if (onSuccess && info.loginToken) {
            onSuccess(info.loginToken, info);
          }
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      message.error('获取用户信息失败');
    }
  };

  /**
   * 初始化二维码
   * @param initId 初始化ID，用于确保只有最新的初始化会执行
   */
  const initQRCode = async (initId?: number) => {
    // 如果提供了 initId，检查是否仍然是最新的初始化请求
    if (initId !== undefined && initId !== initRef.current) {
      return;
    }
    
    // 如果组件已卸载，不执行
    if (!isMountedRef.current) {
      return;
    }
    
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
      
      // 再次检查组件是否仍然挂载且没有被新的实例替换
      if (!isMountedRef.current) {
        return;
      }
      
      // 如果提供了 initId，再次检查是否仍然是最新的初始化
      if (initId !== undefined && initId !== initRef.current) {
        return;
      }
      
      // 更新当前 token 引用
      currentTokenRef.current = newToken;
      setToken(newToken);
      
      // 设置图片地址
      const imgUrl = `/api/wechat/getImg?token=${newToken}&env=${env}`;
      setImgSrc(imgUrl);
      
      setLoading(false);

      // 开始轮询状态（只在组件仍然挂载时）
      if (isMountedRef.current && currentTokenRef.current === newToken) {
        timerRef.current = setInterval(() => {
          // 每次轮询前检查是否仍然是当前实例
          if (isMountedRef.current && currentTokenRef.current === newToken) {
            getStatus(newToken);
          } else {
            // 如果不是当前实例，清除定时器
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, 2000);
      }
    } catch (error) {
      console.error('初始化二维码失败:', error);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  /**
   * 组件挂载时初始化
   */
  useEffect(() => {
    // 增加初始化计数
    const currentInitId = ++initRef.current;
    
    // 标记组件已挂载
    isMountedRef.current = true;
    currentTokenRef.current = '';
    
    // 调用初始化，传入当前初始化ID
    initQRCode(currentInitId);

    // 组件卸载时清除定时器和标记
    return () => {
      isMountedRef.current = false;
      currentTokenRef.current = '';
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
                onClick={() => initQRCode()}
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
