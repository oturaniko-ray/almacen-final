/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilitar Turbopack completamente
  experimental: {
    turbo: false,
  },
  // Configuración adicional para estabilidad
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig;