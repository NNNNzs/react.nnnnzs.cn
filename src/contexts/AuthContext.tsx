/**
 * 认证上下文
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import axios from "axios";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    account: string,
    password: string,
    nickname: string,
    mail?: string,
    emailCode?: string
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** 权限码列表 */
  permissions: string[];
  /** 权限码 → data_scope 映射 */
  dataScopes: Record<string, string>;
  /** 检查用户是否有指定权限码 */
  hasPermission: (code: string) => boolean;
  /** 检查用户是否有指定权限码 + 数据权限 */
  hasDataPermission: (code: string, resourceOwnerId?: number) => boolean;
  /** 刷新用户权限（角色变更后调用） */
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 认证Provider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [dataScopes, setDataScopes] = useState<Record<string, string>>({});

  /**
   * 获取用户信息
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await axios.get("/api/user/info");
      if (response.data.status) {
        setUser(response.data.data);
        // 获取权限信息
        await refreshPermissions();
      }
    } catch {
      setUser(null);
      setPermissions([]);
      setDataScopes({});
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 刷新权限（从服务器重新获取）
   */
  const refreshPermissions = useCallback(async () => {
    try {
      const response = await axios.get("/api/auth/permissions");
      if (response.data.status) {
        setPermissions(response.data.data.permissions || []);
        setDataScopes(response.data.data.dataScopes || {});
      }
    } catch {
      setPermissions([]);
      setDataScopes({});
    }
  }, []);

  /**
   * 检查用户是否有指定权限码
   */
  const hasPermission = useCallback((code: string) => {
    return permissions.includes(code);
  }, [permissions]);

  /**
   * 检查用户是否有指定权限码 + 数据权限
   */
  const hasDataPermission = useCallback((code: string, resourceOwnerId?: number) => {
    const scope = dataScopes[code];
    if (!scope) return false;
    if (scope === 'all') return true;
    if (scope === 'self') {
      return resourceOwnerId !== undefined && resourceOwnerId === user?.id;
    }
    return false;
  }, [dataScopes, user]);

  /**
   * 登录
   */
  const login = useCallback(async (account: string, password: string) => {
    const response = await axios.post("/api/user/login", { account, password });
    if (response.data.status) {
      setUser(response.data.data.userInfo);
      await refreshPermissions();
    } else {
      throw new Error(response.data.message);
    }
  }, [refreshPermissions]);

  /**
   * 退出登录
   */
  const logout = useCallback(async () => {
    await axios.post("/api/user/logout");
    setUser(null);
    setPermissions([]);
    setDataScopes({});
  }, []);

  /**
   * 注册
   */
  const register = useCallback(
    async (account: string, password: string, nickname: string, mail?: string, emailCode?: string) => {
      const response = await axios.post("/api/user/register", {
        account,
        password,
        nickname,
        mail,
        emailCode,
      });
      if (response.data.status) {
        setUser(response.data.data.userInfo);
      } else {
        throw new Error(response.data.message);
      }
    },
    []
  );

  /**
   * 初始化时获取用户信息
   */
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      register,
      refreshUser,
      permissions,
      dataScopes,
      hasPermission,
      hasDataPermission,
      refreshPermissions,
    }),
    [user, loading, login, logout, register, refreshUser, permissions, dataScopes, hasPermission, hasDataPermission, refreshPermissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 使用认证上下文的Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth必须在AuthProvider内部使用");
  }
  return context;
}
