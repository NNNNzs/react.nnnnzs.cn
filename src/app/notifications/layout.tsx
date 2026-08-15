import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function NotificationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
