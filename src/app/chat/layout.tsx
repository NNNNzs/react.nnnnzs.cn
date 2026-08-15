import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
