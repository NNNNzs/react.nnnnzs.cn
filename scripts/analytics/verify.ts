import 'dotenv/config';

async function main() {
  const { fetchGa4Summary, Ga4ConfigurationError, Ga4ReportError } = await import('../../src/services/ga4');
  const { prisma } = await import('../../src/lib/prisma');
  try {
    const { report, generatedAt } = await fetchGa4Summary();
    console.log(JSON.stringify({ source: 'ga4', totals: report.rows[0]?.metrics || {}, timeZone: report.metadata.timeZone, generatedAt }));
  } catch (error) {
    console.error(error instanceof Ga4ConfigurationError || error instanceof Ga4ReportError ? error.message : 'GA4 报表验证失败，请检查 Data API、服务账号权限与服务器网络');
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
void main();
