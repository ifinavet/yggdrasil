import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Stillingsannonser",
};

export default function ListingsLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return children;
}
