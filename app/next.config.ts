import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
    ],
    localPatterns: [
      {
        pathname: '/gallery-covers/**',
      },
      {
        pathname: '/about/**',
      },
    ],
  },
};

export default nextConfig;
