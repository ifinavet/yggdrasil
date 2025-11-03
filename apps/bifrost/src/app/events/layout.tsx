import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Arrangementer",
};

export default function EventLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return children;
}
