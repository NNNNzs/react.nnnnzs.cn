import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '隐私政策 - NNNNzs',
  description: '了解 NNNNzs 如何使用账号、通知、统计与广告相关数据，以及你可以行使的控制权。',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
    <h1>隐私政策</h1>
    <p><strong>生效日期：2026 年 8 月 16 日</strong></p>
    <p>本站仅为账号、评论互动、站内通知和可选邮件提醒处理必要的昵称、头像、邮箱及 GitHub 授权资料。GitHub 邮箱只在本地邮箱为空时同步，不会覆盖你手动填写的地址。</p>
    <h2>访问统计与广告</h2>
    <p>本站使用 Google Analytics 4（GA4）了解页面访问、设备类型和站内使用趋势，并使用 Google AdSense 展示广告。Google 及其合作伙伴可能使用 Cookie、本地存储或类似技术，根据你此前访问本站或其他网站的情况投放、衡量和限制广告。</p>
    <p>第三方广告供应商（包括 Google）可能使用广告 Cookie 展示个性化或非个性化广告。你可以访问 <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google 广告设置</a>关闭个性化广告，也可以通过 <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">AboutAds</a>了解并管理部分第三方供应商的个性化广告选择。浏览器设置也可用于清除或阻止 Cookie，但这可能影响部分功能。</p>
    <h2>数据保存期限</h2>
    <p>账号资料在账号持续使用期间保存；评论及其必要关联信息在内容保留期间保存。评论通知保留 180 天，邮件投递审计保留 90 天。GA4 与广告服务的数据保存由相应服务商依据其政策和本站配置处理。</p>
    <h2>通知数据</h2>
    <p>评论通知只保存事件摘要、关联文章和评论标识以及阅读状态，保留 180 天。邮件投递审计不保存评论正文，保留 90 天。</p>
    <h2>你的控制权</h2>
    <p>你可以在<Link href="/c/user/info">个人设置</Link>关闭站内或邮件通知；每封通知邮件也提供对应类型的一键退订链接。你还可以请求查询、更正或删除由本站直接保存的个人资料。</p>
    <h2>联系渠道</h2>
    <p>如对隐私、数据或广告设置有疑问，请发送邮件至 <a href="mailto:nnnnzs@vip.qq.com">nnnnzs@vip.qq.com</a>，或通过 <a href="https://github.com/NNNNzs" target="_blank" rel="noreferrer">GitHub @NNNNzs</a> 联系。</p>
    <p>继续使用服务或注册账号即表示同意本政策。另请阅读<Link href="/notification-policy">通知策略</Link>。</p>
  </main>;
}
