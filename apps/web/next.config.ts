import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "*.supabase.co" },
      { hostname: "raw.githubusercontent.com" },
      { hostname: "arweave.net" },
      { hostname: "*.ipfs.io" },
      { hostname: "cdn.geckoterminal.com" },
      { hostname: "assets.coingecko.com" },
      { hostname: "cf-ipfs.com" },
      { hostname: "gmgn.ai" },
      { hostname: "*.digitaloceanspaces.com" },
      { hostname: "pbs.twimg.com" },
      { hostname: "unavatar.io" },
    ],
  },
  env: {
    API_URL: process.env.API_URL,
  },
  serverExternalPackages: ["ably", "got", "cacheable-request", "keyv"],
};

export default nextConfig;
