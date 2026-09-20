import ClerkProvider from "@workspace/auth/provider";
import { PostHogPageView } from "@workspace/auth/telemetry-client";
import Footer from "@workspace/ui/components/footer";
import { Toaster } from "@workspace/ui/components/sonner";
import { eina } from "@workspace/ui/fonts/eina-font";
import { ThemeProvider } from "@workspace/ui/providers/theme-provider";
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/header";
import ConvexClientProvider from "@/providers/convex-client-provider";
import PostHogProvider from "@/providers/posthog-provider";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3003";

export const metadata: Metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		template: "Navet | %s",
		default: "Navet - Hugin",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		<html lang="nb" suppressHydrationWarning>
			<body className={`${eina.className} antialiased`}>
				<Suspense fallback={null}>
					<PostHogProvider>
						<ClerkProvider>
							<ConvexClientProvider>
								<ThemeProvider>
									<div className="flex h-screen flex-col overflow-y-auto">
										<Header />
										<main className="mb-12 flex-1">{children}</main>
										<Footer />
										<Toaster richColors position="bottom-right" />
									</div>
									<Suspense fallback={null}>
										<PostHogPageView site="hugin" />
									</Suspense>
								</ThemeProvider>
							</ConvexClientProvider>
						</ClerkProvider>
					</PostHogProvider>
				</Suspense>
			</body>
		</html>
	);
}
