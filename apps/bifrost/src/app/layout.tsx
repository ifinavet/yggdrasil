import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { auth } from "@clerk/nextjs/server";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { Toaster } from "@workspace/ui/components/sonner";
import Header from "@/components/common/header";
import BifrostSidebar from "@/components/common/sidebar/sidebar";
import Providers from "@/providers/providers";
import UnauthorizedPage from "./unauthorized";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
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
  const { orgId } = await auth();

  return (
    <html lang='no' suppressHydrationWarning>
      <body className={`antialiased ${interSans.className}`}>
        <ClerkProvider>
          <SidebarProvider>
            <ThemeProvider
              attribute='class'
              defaultTheme='system'
              enableSystem
              disableTransitionOnChange
            >
              <Providers>
                {!orgId ? <UnauthorizedPage /> : <>
                  <BifrostSidebar />
                  <SidebarInset>
                    <Header />
                    <main className='flex h-full flex-col gap-4 p-4'>{children}</main>
                  </SidebarInset>
                  <Toaster richColors position='top-center' />
                  {process.env.NODE_ENV === "development" && (
                    <ReactQueryDevtools initialIsOpen={false} />
                  )}
                </>}
              </Providers>
            </ThemeProvider>
          </SidebarProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
