import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

export const metadata = {
	metadataBase: new URL(defaultUrl),
	title: {
		template: "%s | Navet",
		default: "Navet",
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
						{children}
						<Toaster richColors position='top-center' />
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
