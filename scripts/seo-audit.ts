import { getPostSeoAuditPage } from '@/services/post-seo-audit';
import { disconnectPrisma } from '@/lib/prisma';

try {
  const result = await getPostSeoAuditPage({
    pageNum: 1,
    pageSize: 10_000,
    hide: 'all',
  });

  const summary = result.record.reduce<Record<string, number>>((counts, record) => {
    counts[record.grade] = (counts[record.grade] || 0) + 1;
    return counts;
  }, {});

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: result.total,
    summary,
    records: result.record,
  }, null, 2));
} finally {
  await disconnectPrisma();
}
