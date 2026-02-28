import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "*.supabase.co" },
      { hostname: "raw.githubusercontent.com" },
      { hostname: "arweave.net" },
      { hostname: "*.ipfs.io" },
    ],
  },
  env: {
    API_URL: process.env.API_URL,
  },
};

export default nextConfig;
