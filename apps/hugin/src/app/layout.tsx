import ClerkProvider from "@workspace/auth/provider";
import { HUGIN_LOCAL_URL } from "@workspace/shared/constants";
import { Toaster } from "@workspace/ui/components/sonner";
import { eina } from "@workspace/ui/fonts/eina-font";
import { ThemeProvider } from "@workspace/ui/providers/theme-provider";
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/header";
import ConvexClientProvider from "@/providers/convex-client-provider";
import PageTelemetry from "@/providers/page-telemetry";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : HUGIN_LOCAL_URL;

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
					<ClerkProvider>
						<ConvexClientProvider>
							<ThemeProvider>
								<PageTelemetry>
									<div className="flex h-screen flex-col overflow-y-auto">
										<Header />
										<main className="wrap-break-word mx-6 mb-12 min-w-0 max-w-5xl flex-1 whitespace-normal text-balance lg:mx-auto">
											{children}
										</main>
										<Toaster richColors position="bottom-right" />
									</div>
								</PageTelemetry>
							</ThemeProvider>
						</ConvexClientProvider>
					</ClerkProvider>
				</Suspense>
			</body>
		</html>
	);
}
