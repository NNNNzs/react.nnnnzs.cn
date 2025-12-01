/**
 * 管理后台布局
 */
export default function CLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-scrren w-screen overflow-hidden flex-col">
      <main className="flex-1 bg-slate-50 dark:bg-slate-900">{children}</main>
    </div>
  );
}
