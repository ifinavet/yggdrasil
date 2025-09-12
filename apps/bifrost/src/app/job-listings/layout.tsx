import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Stillingsannonser",
};

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
