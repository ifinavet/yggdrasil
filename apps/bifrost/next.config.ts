import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tame-toucan-856.convex.cloud",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
        port: "",
        pathname: "**",
      },
    ],
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
