/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para webpack (producción)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
  // Configuración para Turbopack (desarrollo)
  experimental: {
    turbo: {
      resolveAlias: {
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      },
    },
  },
};

module.exports = nextConfig;