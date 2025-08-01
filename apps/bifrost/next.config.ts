
import type { NextConfig } from "next";

if (!process.env.NEXT_PUBLIC_CONVEX_HOSTNAME) {
  throw new Error("NEXT_PUBLIC_CONVEX_HOSTNAME environment variable is not set.");
}

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_CONVEX_HOSTNAME,
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
