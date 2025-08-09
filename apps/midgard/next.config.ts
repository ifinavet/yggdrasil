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
  async rewrites() {
    return [
      {
        source: "/relay-aXgZ/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-aXgZ/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/relay-aXgZ/flags",
        destination: "https://eu.i.posthog.com/flags",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
