import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Semesterplan",
};

export default function SemesterPlanLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return children;
}
