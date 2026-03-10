import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ CONFIGURACIÓN WEBPACK (para producción)
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
  
  // ✅ CONFIGURACIÓN TURBOPACK (para desarrollo)
  turbopack: {
    resolveAlias: {
      child_process: 'empty-module',
      fs: 'empty-module',
      net: 'empty-module',
      tls: 'empty-module',
      dns: 'empty-module',
    },
  },
};

export default nextConfig;