import {Inter} from "next/font/google";
import "./globals.css";
import {ThemeProvider} from "@/components/theme-provider";
import {Toaster} from "@/components/ui/sonner";

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata = {
    metadataBase: new URL(defaultUrl),
    title: "Navet - Project Unagi",
    description:
        "Bindeledd mellom studenter og næringslivet for studentene på institutt for informatikk ved UiO.",
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
        <html lang='no' className={interSans.className} suppressHydrationWarning>
            <body>
                <ThemeProvider
                    attribute='class'
                    defaultTheme='system'
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
