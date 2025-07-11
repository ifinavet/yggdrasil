import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@workspace/ui/components/sonner";
import { eina } from "@/components/common/eina-font";
import Footer from "@/components/common/footer";
import Header from "@/components/common/header/header";
import ReactQueryProvider from "@/providers/react-query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export const metadata: Metadata = {
	title: "IFI-Navet",
	description: "Bedriftskontakten ved Institutt for Informatikk",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<ReactQueryProvider>
				<html lang='no' suppressHydrationWarning>
					<body className={`${eina.className} antialiased`}>
						<ThemeProvider attribute='class' defaultTheme='light' disableTransitionOnChange>
							<div className='flex h-screen flex-col'>
								<Header />
								<main className='mb-12 flex-1'>{children}</main>
								<Footer />
								<Toaster richColors />
							</div>
						</ThemeProvider>
					</body>
				</html>
			</ReactQueryProvider>
		</ClerkProvider>
	);
}
