/**
 * 管理后台布局
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-900">{children}</main>
      <Footer />
    </div>
  );
}
