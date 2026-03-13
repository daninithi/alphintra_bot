import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Alphintra Admin - Management Console',
    template: '%s | Alphintra Admin',
  },
  description: 'Alphintra Admin Management Console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-black text-white font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
