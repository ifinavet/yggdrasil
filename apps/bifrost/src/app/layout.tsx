import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "@workspace/ui/globals.css";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@workspace/ui/components/sonner";
import ReactQueryProvider from "@/lib/react-query-provider";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

export const metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		template: "%s | Navet - Bifrost",
		default: "Navet - Bifrost",
	},
	description:
		"Bindeledd mellom studenter og næringslivet for studentene på institutt for informatikk ved UiO.",
};

const interSans = Inter({
	display: "swap",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<html lang='no' suppressHydrationWarning>
				<body className={`antialiased ${interSans.className}`}>
					<ThemeProvider
						attribute='class'
						defaultTheme='system'
						enableSystem
						disableTransitionOnChange
					>
						<ReactQueryProvider>
							{children}
							<Toaster richColors position='top-center' />
							{process.env.NODE_ENV === "development" && (
								<ReactQueryDevtools initialIsOpen={false} />
							)}
						</ReactQueryProvider>
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
