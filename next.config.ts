import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lvhucihmyhwqrrwdiirf.supabase.co",
        port: "",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
