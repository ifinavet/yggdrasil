import type { Metadata } from "next";
import "./globals.css";
import { nbNO } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@workspace/ui/components/sonner";
import { Suspense } from "react";
import { Consent } from "@/components/common/consent";
import { eina } from "@/components/common/eina-font";
import Footer from "@/components/common/footer";
import Header from "@/components/common/header/header";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import ConvexClientProvider from "@/providers/convex-clerk-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import PostHogPageView from "./posthog-page-view";

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
		"Navet er bedriftskontakten ved Institutt for Informatikk. Vi er binneleddet mellom studenene og bedriftene.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='no' suppressHydrationWarning>
			<body className={`${eina.className} antialiased`}>
				<ClerkProvider localization={nbNO}>
					<ConvexClientProvider>
						<ThemeProvider attribute='class' defaultTheme='light' disableTransitionOnChange>
							<div className='flex h-screen flex-col overflow-y-auto'>
								<Header />
								<main className='mb-12 flex-1'>{children}</main>
								<Footer />
								<Toaster richColors />
							</div>
							<Consent />
							<Suspense fallback={null}>
								<PostHogPageView />
							</Suspense>
						</ThemeProvider>
					</ConvexClientProvider>
				</ClerkProvider>
			</body>
		</html>
	);
}
