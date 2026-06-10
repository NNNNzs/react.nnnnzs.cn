/**
 * 游客设备ID生成与管理
 * 在 localStorage 中持久化 UUID，用于标识未登录用户
 */

const STORAGE_KEY = 'chat-device-id';

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取或创建设备ID
 * 优先从 localStorage 读取，不存在则生成新ID并持久化
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}
