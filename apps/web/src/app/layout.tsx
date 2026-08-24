import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Quản Lý Khu Phố | Nền tảng số hoá quản lý khu phố',
  description:
    'Hệ thống quản lý khu phố thông minh dành cho cư dân, tổ trưởng tổ dân phố và cán bộ phường.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={`${inter.className} antialiased selection:bg-blue-500 selection:text-white`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
