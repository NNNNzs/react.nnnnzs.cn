import 'dotenv/config';
import { createScriptPrismaClient } from '../prisma-client';

/** 仅初始化本功能的权限、配置和接口，不运行全量 RBAC seed。 */
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log('预览：补齐 analytics:view 权限与 admin 授权；补齐 GA4 报表配置；同步两个只读 API 并停用旧采集接口，保持 MCP 关闭。');
    return;
  }
  const prisma = createScriptPrismaClient();
  try {
    await prisma.$transaction(async tx => {
      const permission = await tx.tbPermission.upsert({
        where: { code: 'analytics:view' },
        create: { code: 'analytics:view', name: '访问统计', module: 'analytics', type: 'menu' },
        update: { name: '访问统计', module: 'analytics', type: 'menu', status: 1, sort_order: 1 },
      });
      const admin = await tx.tbRole.findUnique({ where: { code: 'admin' } });
      if (!admin) throw new Error('管理员角色不存在');
      await tx.tbRolePermission.upsert({
        where: { role_id_permission_id: { role_id: admin.id, permission_id: permission.id } },
        create: { role_id: admin.id, permission_id: permission.id, data_scope: 'all' }, update: { data_scope: 'all' },
      });
      for (const config of [
        { key: 'ga4.property_id', title: 'GA4 数字 Property ID', value: process.env.GA4_PROPERTY_ID || '', remark: '报表媒体资源数字 ID，不是 G- 开头的测量 ID。' },
        { key: 'ga4.stats_start_date', title: 'GA4 累计统计起始日期', value: process.env.GA4_STATS_START_DATE || '', remark: '可选 YYYY-MM-DD；留空时读取媒体资源可查询的历史累计数据。' },
      ]) {
        if (!(await tx.tbConfig.findFirst({ where: { key: config.key } }))) await tx.tbConfig.create({ data: { ...config, status: 1, created_at: new Date() } });
      }
      for (const [code, name, method] of [
        ['public', '公开 GA4 累计统计', 'GET'], ['overview', 'GA4 访问概览', 'GET'],
      ]) {
        const data = { name, module: 'analytics', api_path: `/api/analytics/${code}`, api_method: method, permission_code: code === 'public' ? null : 'analytics:view', mcp_available: 0, mcp_enabled: 0, status: 1, auto_discovered: 1, synced_at: new Date() };
        await tx.tbApiRegistry.upsert({ where: { code: `analytics_${code}` }, create: { code: `analytics_${code}`, ...data }, update: data });
      }
      await tx.tbApiRegistry.updateMany({
        where: { code: { in: ['analytics_pages', 'analytics_sources'] } },
        data: { status: 0, mcp_enabled: 0, mcp_available: 0 },
      });
      await tx.tbApiRegistry.updateMany({ where: { code: { in: ['analytics_collect', 'analytics_status'] } }, data: { status: 0, mcp_enabled: 0, mcp_available: 0 } });
      await tx.tbConfig.deleteMany({ where: { key: { in: ['analytics.enabled', 'analytics.started_at'] } } });
    });
    console.log('GA4 报表配置、权限与两个只读接口已初始化。');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('访问统计初始化失败，事务已回滚。'); process.exitCode = 1; });
