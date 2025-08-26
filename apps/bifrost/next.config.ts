import { withSentryConfig } from "@sentry/nextjs";
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

export default withSentryConfig(nextConfig, {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "ifi-navet",

	project: "bifrost",

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: false,

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,
});
