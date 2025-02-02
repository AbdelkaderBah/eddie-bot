import './globals.css';

import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Eddie BOT',
  description:
    'A Binance trader bot that uses technical analysis to make trades.',
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen w-full flex-col">{children}</body>
      <Analytics />
    </html>
  );
}
