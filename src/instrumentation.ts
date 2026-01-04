/**
 * Next.js Instrumentation Hook
 * 在应用启动时执行初始化代码
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * 
 * 注意：Qdrant 初始化已移至独立脚本，使用 pnpm run qdrant:init 手动初始化
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 只在 Node.js 运行时执行（服务端）
    // Qdrant 初始化已移至独立脚本，不再在启动时自动执行
  }
}
