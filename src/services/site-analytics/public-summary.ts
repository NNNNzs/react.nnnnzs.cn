import { getCachedGa4Summary } from '@/services/ga4';
import type { PublicAnalyticsSummary } from '@/dto/analytics.dto';

export async function getPublicAnalyticsSummary(): Promise<PublicAnalyticsSummary> {
  const { report, generatedAt, configuredStart } = await getCachedGa4Summary();
  const total = report.rows[0]?.metrics || {};
  return { visitors: total.totalUsers || '0', pageViews: total.screenPageViews || '0',
    startedAt: configuredStart, updatedAt: generatedAt, source: 'ga4' };
}
