import type { NextConfig } from "next";

export function createNextConfig(options: {
	project: string;
	widenClientFileUpload: boolean;
	devIndicators?: boolean;
}): NextConfig;
