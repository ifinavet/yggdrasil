import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	transpilePackages: ["@workspace/ui"],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lvhucihmyhwqrrwdiirf.supabase.co",
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
	},
};

export default nextConfig;
