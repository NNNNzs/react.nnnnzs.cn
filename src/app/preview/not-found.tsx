export default function PreviewNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 text-center">
      <div className="w-full">
        <p className="text-sm text-slate-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">此预览不可用</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">链接可能已过期、被撤销，或地址不正确。</p>
      </div>
    </main>
  );
}
