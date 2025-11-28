/**
 * 标签页布局
 */

import Footer from '@/components/Footer';

export default function TagsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

