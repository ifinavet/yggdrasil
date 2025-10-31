import { ClerkProvider } from "@clerk/nextjs";
import {
	SidebarInset,
	SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { Toaster } from "@workspace/ui/components/sonner";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/common/header";
import BifrostSidebar from "@/components/common/sidebar/sidebar";
import Providers from "@/providers/convex-client-provider";
import ConvexClientProvider from "@/providers/convex-client-provider";
import { hasBasicRights } from "@/utils/auth";
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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const hasRights = await hasBasicRights();

	return (
		<html lang="nb" suppressHydrationWarning>
			<body className={`antialiased ${interSans.className}`}>
				<ClerkProvider>
					<ConvexClientProvider>
						<SidebarProvider>
							<ThemeProvider
								attribute="class"
								defaultTheme="system"
								enableSystem
								disableTransitionOnChange
							>
								<Providers>
									{!hasRights ? (
										<UnauthorizedPage />
									) : (
										<>
											<BifrostSidebar />
											<SidebarInset className="max-h-full">
												<Header />
												<main className="flex max-h-full flex-col gap-4 p-4">
													{children}
												</main>
											</SidebarInset>
											<Toaster richColors position="top-center" />
											<Suspense fallback={null}>
												<PostHogPageView />
											</Suspense>
										</>
									)}
								</Providers>
							</ThemeProvider>
						</SidebarProvider>
					</ConvexClientProvider>
				</ClerkProvider>
			</body>
		</html>
	);
}
