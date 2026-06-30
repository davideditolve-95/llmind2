// Pulisci le variabili d'ambiente vuote per evitare crash durante la build (es. TypeError: Invalid URL)
['NEXTAUTH_URL', 'NEXT_PUBLIC_API_URL', 'KEYCLOAK_ISSUER'].forEach((varName) => {
  if (process.env[varName] === '') {
    delete process.env[varName];
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Modalità standalone per il build Docker ottimizzato
  output: 'standalone',

  // Configurazione per React Three Fiber (transpila i moduli Three.js)
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Header di sicurezza per il deployment in produzione
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },

  // Ignora errori di TS per velocizzare e alleggerire il build in produzione
  typescript: {
    ignoreBuildErrors: true,
  },

  // Limita i worker Next.js a 1 per evitare crash Out-Of-Memory (OOM) su macchine VPS
  experimental: {
    cpus: 1,
  },

  // Variabile d'ambiente pubblica (accessibile nel browser)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000',
  },
};

export default nextConfig;
