import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function BindWechatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
