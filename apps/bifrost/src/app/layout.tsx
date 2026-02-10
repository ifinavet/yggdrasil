import { ClerkProvider } from "@clerk/nextjs";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { Toaster } from "@workspace/ui/components/sonner";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import { hasBasicRights } from "@workspace/auth";
import Header from "@/components/common/header";
import BifrostSidebar from "@/components/common/sidebar/sidebar";
import ConvexClientProvider from "@/providers/convex-client-provider";
import PostHogPageView from "./posthog-page-view";
import UnauthorizedPage from "./unauthorized";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3001";

export const metadata: Metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		template: "%s | Navet - Bifrost",
		default: "Navet - Bifrost",
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
							<SidebarProvider>
								<ThemeProvider
									attribute="class"
									defaultTheme="system"
									enableSystem
									disableTransitionOnChange
								>
									<Suspense fallback={null}>
										<AuthorizedContent>{children}</AuthorizedContent>
									</Suspense>
								</ThemeProvider>
							</SidebarProvider>
						</ConvexClientProvider>
					</ClerkProvider>
				</Suspense>
			</body>
		</html>
	);
}

async function AuthorizedContent({ children }: Readonly<{ children: React.ReactNode }>) {
	const hasRights = await hasBasicRights();

	if (!hasRights) {
		return <UnauthorizedPage />;
	}

	return (
		<>
			<BifrostSidebar />
			<SidebarInset className="max-h-full">
				<Header />
				<main className="flex max-h-full flex-col gap-4 p-4">{children}</main>
			</SidebarInset>
			<Toaster richColors position="top-center" />
			<Suspense fallback={null}>
				<PostHogPageView />
			</Suspense>
		</>
	);
}
