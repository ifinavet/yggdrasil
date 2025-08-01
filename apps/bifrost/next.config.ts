import type { NextConfig } from "next";

if (!process.env.CONVEX_HOSTNAME) {
  throw new Error("CONVEX_HOSTNAME environment variable is not set.");
}

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.CONVEX_HOSTNAME,
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
