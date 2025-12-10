/**
 * 微信小程序相关工具类
 * 用于处理微信小程序的 API 调用
 */

import axios from 'axios';

/**
 * 微信 access_token 响应
 */
interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * 微信 code2session 响应
 */
interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信小程序配置
 */
interface WechatConfig {
  appId: string;
  appSecret: string;
}

/**
 * 微信小程序工具类
 */
export class Wechat {
  private config: WechatConfig;

  constructor() {
    this.config = {
      appId: process.env.WX_APP_ID || '',
      appSecret: process.env.WX_APP_SECRET || '',
    };

    if (!this.config.appId || !this.config.appSecret) {
      console.warn('⚠️  微信小程序配置未设置，请检查环境变量 WX_APP_ID 和 WX_APP_SECRET');
    }
  }

  /**
   * 获取微信 access_token
   * @returns Promise<AccessTokenResponse>
   */
  async getAccessToken(): Promise<AccessTokenResponse> {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`;
    
    try {
      const response = await axios.get<AccessTokenResponse>(url);
      return response.data;
    } catch (error) {
      console.error('获取微信 access_token 失败:', error);
      throw new Error('获取微信 access_token 失败');
    }
  }

  /**
   * 通过 code 换取 openid 和 session_key
   * @param code 微信小程序登录凭证
   * @returns Promise<Code2SessionResponse>
   */
  async code2Session(code: string): Promise<Code2SessionResponse> {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.config.appId}&secret=${this.config.appSecret}&js_code=${code}&grant_type=authorization_code`;
    
    try {
      const response = await axios.get<Code2SessionResponse>(url);
      return response.data;
    } catch (error) {
      console.error('微信 code2session 失败:', error);
      throw new Error('微信 code2session 失败');
    }
  }

  /**
   * 生成小程序码
   * @param scene 场景值（最长32位）
   * @param page 页面路径
   * @param envVersion 环境版本（release/trial/develop）
   * @returns Promise<Buffer>
   */
  async getUnlimitedQRCode(
    scene: string,
    page: string = 'pages/index/index',
    envVersion: 'release' | 'trial' | 'develop' = 'trial'
  ): Promise<Buffer> {
    const { access_token } = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${access_token}`;

    try {
      const response = await axios.post(
        url,
        {
          scene,
          page,
          env_version: envVersion,
          check_path: false,
        },
        {
          responseType: 'arraybuffer',
        }
      );

      // 检查返回内容类型
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('image')) {
        return Buffer.from(response.data);
      } else {
        // 如果不是图片，说明返回了错误信息
        const errorMsg = Buffer.from(response.data).toString('utf-8');
        console.error('❌ 微信API返回错误:', errorMsg);
        
        // 尝试解析错误信息
        try {
          const errorJson = JSON.parse(errorMsg);
          throw new Error(`生成小程序码失败: ${errorJson.errmsg || errorMsg}`);
        } catch {
          throw new Error(`生成小程序码失败: ${errorMsg}`);
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ 网络请求失败:', error.message);
        if (error.response) {
          const errorData = Buffer.from(error.response.data).toString('utf-8');
          console.error('❌ 错误响应:', errorData);
        }
      } else {
        console.error('❌ 生成小程序码失败:', error);
      }
      throw error;
    }
  }
}

/**
 * 导出 Wechat 实例
 */
export const wechat = new Wechat();
