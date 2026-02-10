import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@workspace/ui/components/sonner";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/header";
import ConvexClientProvider from "@/providers/convex-client-provider";
import PostHogPageView from "./posthog-page-view";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3003";

export const metadata: Metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		template: "%s",
		default: "Navet - Hugin",
	},
};

const interSans = Inter({
	display: "swap",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		// biome-ignore lint: This is a valid html attribute
		<html lang="nb" suppressHydrationWarning>
			<body className={`antialiased ${interSans.className}`}>
				<Suspense fallback={null}>
					<ClerkProvider>
						<ConvexClientProvider>
							<ThemeProvider
								attribute="class"
								defaultTheme="system"
								enableSystem
								disableTransitionOnChange
							>
								<main className="wrap-break-word mx-6 min-w-0 max-w-5xl whitespace-normal text-balance lg:mx-auto">
									<Header />
									{children}
								</main>
								<Toaster richColors position="bottom-right" />
								<Suspense fallback={null}>
									<PostHogPageView />
								</Suspense>
							</ThemeProvider>
						</ConvexClientProvider>
					</ClerkProvider>
				</Suspense>
			</body>
		</html>
	);
}
