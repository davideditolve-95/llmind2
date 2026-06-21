import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import Navbar from '@/components/ui/Navbar';
import ChatWidget from '@/components/ui/ChatWidget';
import AuthProvider from '@/components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'LLMind2',
  description: 'Clinical AI research platform for ICD-11 exploration, benchmarking, and RAG workflows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="emerald">
      <body>
        <AuthProvider>
          <I18nProvider>
            <div className="min-h-screen bg-base-200">
              <Navbar />
              <main>{children}</main>
              <ChatWidget />
            </div>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
