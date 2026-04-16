import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import Navbar from '@/components/ui/Navbar';

export const metadata: Metadata = {
  title: 'ICD-11 Explorer & Clinical AI',
  description:
    'Piattaforma universitaria di ricerca per l\'esplorazione ICD-11 in 3D, benchmarking multi-modello LLM e diagnosi clinica differenziale.',
  keywords: ['ICD-11', 'clinical AI', 'research', 'LLM', 'benchmark', 'DSM-5', 'diagnosis'],
  authors: [{ name: 'University Research Lab' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-warm-50 font-sans antialiased">
        {/* Provider i18n — wrappa tutta l'app per le traduzioni */}
        <I18nProvider>
          {/* Navbar principale con navigazione e selettore lingua */}
          <Navbar />
          {/* Contenuto principale delle pagine */}
          <main className="flex flex-col min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
