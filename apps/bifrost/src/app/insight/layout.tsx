import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Innsikt",
};

export default function EngagementLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return children;
}
