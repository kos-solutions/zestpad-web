import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'ZestPad — Caietul digital al clasei',
  description: 'Scrii de mână, se sincronizează automat. Fără distrageri.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ZestPad' },
};

export const viewport: Viewport = {
  themeColor: '#1b70f0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // evita zoom accidental cu palma pe tableta
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
