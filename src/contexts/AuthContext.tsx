/**
 * 认证上下文
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (account: string, password: string, nickname: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 认证Provider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 获取用户信息
   */
  const refreshUser = async () => {
    try {
      const response = await axios.get('/api/user/info');
      if (response.data.status) {
        setUser(response.data.data);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 登录
   */
  const login = async (account: string, password: string) => {
    const response = await axios.post('/api/user/login', { account, password });
    if (response.data.status) {
      setUser(response.data.data.userInfo);
    } else {
      throw new Error(response.data.message);
    }
  };

  /**
   * 退出登录
   */
  const logout = async () => {
    await axios.post('/api/user/logout');
    setUser(null);
  };

  /**
   * 注册
   */
  const register = async (account: string, password: string, nickname: string) => {
    const response = await axios.post('/api/user/register', {
      account,
      password,
      nickname,
    });
    if (response.data.status) {
      setUser(response.data.data.userInfo);
    } else {
      throw new Error(response.data.message);
    }
  };

  /**
   * 初始化时获取用户信息
   */
  useEffect(() => {
    refreshUser();
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 使用认证上下文的Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}

