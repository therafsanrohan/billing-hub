import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Corevow Billing',
  description: 'Mobile-First POS, Inventory & Billing Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Corevow Billing',
    startupImage: [
      '/icons/apple-splash-2048-2732.jpg',
    ],
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: 'Corevow Billing',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-slate-50 flex flex-col">
        {children}
      </body>
    </html>
  );
}
