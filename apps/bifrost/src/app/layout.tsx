import { SidebarProvider } from "@workspace/ui/components/sidebar";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Providers from "@/providers/convex-client-provider";
import ConvexClientProvider from "@/providers/convex-client-provider";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

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
	return (
		<html lang="no" suppressHydrationWarning>
			<body className={`antialiased ${interSans.className}`}>
				<ConvexClientProvider>
					<SidebarProvider>
						<ThemeProvider
							attribute="class"
							defaultTheme="system"
							enableSystem
							disableTransitionOnChange
						>
							<Providers>{children}</Providers>
						</ThemeProvider>
					</SidebarProvider>
				</ConvexClientProvider>
			</body>
		</html>
	);
}
