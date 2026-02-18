/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // En el cliente, reemplazar módulos de Node.js con polyfills vacíos
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
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
        crypto: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
      },
    },
  },
};

module.exports = nextConfig;