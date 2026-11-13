import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: process.env.NEXT_DIST_DIR,
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["*.ngrok-free.app"],
  images: {
    qualities: [85],
  },
  experimental: {
    globalNotFound: true,
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
