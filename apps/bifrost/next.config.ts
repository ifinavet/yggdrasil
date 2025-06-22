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
		],
	},
	experimental: {
		authInterrupts: true,
	},
};

export default nextConfig;
