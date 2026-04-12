import type { Metadata } from 'next';

import './globals.css';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'AutovestAI',
  description: 'Broker client portal, terminal, and backoffice',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-primary">
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <Providers>{children}</Providers>
          </div>
          <footer className="border-t border-white/10 bg-[#08101D] px-4 py-4 text-xs leading-6 text-slate-400">
            <div className="mx-auto max-w-6xl">
              CFDs and other leveraged products carry a high risk of loss and may
              not be suitable for all investors. Funding, withdrawals, and live
              trading access remain subject to KYC, compliance review, and
              operational controls.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
