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

  // Variabile d'ambiente pubblica (accessibile nel browser)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
};

export default nextConfig;
