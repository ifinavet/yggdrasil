import type { Metadata } from "next";
import "./globals.css";
import { nbNO } from "@clerk/localizations";
import { AuthProvider } from "@workspace/auth/client";
import PostHogPageView from "@workspace/ui/components/posthog-page-view";
import { Toaster } from "@workspace/ui/components/sonner";
import { Suspense } from "react";
import { Consent } from "@/components/common/consent";
import { eina } from "@/components/common/eina-font";
import Footer from "@/components/common/footer";
import Header from "@/components/common/header";
import ConvexClientProvider from "@/providers/convex-clerk-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

export const metadata: Metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		default: "Navet",
		template: "%s | Navet",
	},
	description:
		"Navet er bedriftskontakten ved Institutt for Informatikk. Vi er binneleddet mellom studentene og bedriftene.",
};

export default function RootLayout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (
		<html lang="no" suppressHydrationWarning>
			<body className={`${eina.className} antialiased`}>
				<Suspense fallback={null}>
					<AuthProvider localization={nbNO}>
						<ConvexClientProvider>
							<ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
								<div className="flex h-screen flex-col overflow-y-auto">
									<Header />
									<main className="mb-12 flex-1">{children}</main>
									<Footer />
									<Toaster richColors />
								</div>
								<Consent />
								<Suspense fallback={null}>
									<PostHogPageView site="midgard" />
								</Suspense>
							</ThemeProvider>
						</ConvexClientProvider>
					</AuthProvider>
				</Suspense>
			</body>
		</html>
	);
}
