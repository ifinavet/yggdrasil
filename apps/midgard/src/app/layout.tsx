import { MIDGARD_LOCAL_URL } from "@workspace/shared/constants";
import type { Metadata } from "next";
import "./globals.css";
import { nbNO } from "@clerk/localizations";
import ClerkProvider from "@workspace/auth/provider";
import { PostHogPageView } from "@workspace/auth/telemetry-client";
import Footer from "@workspace/ui/components/footer";
import { Toaster } from "@workspace/ui/components/sonner";
import { eina } from "@workspace/ui/fonts/eina-font";
import { ThemeProvider } from "@workspace/ui/providers/theme-provider";
import { Suspense } from "react";
import { Consent } from "@/components/common/consent";
import Header from "@/components/common/header";
import ConvexClientProvider from "@/providers/convex-clerk-provider";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : MIDGARD_LOCAL_URL;

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
					<ClerkProvider localization={nbNO}>
						<ConvexClientProvider>
							<ThemeProvider>
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
					</ClerkProvider>
				</Suspense>
			</body>
		</html>
	);
}
