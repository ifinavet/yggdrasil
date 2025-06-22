import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "@workspace/ui/globals.css";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@workspace/ui/components/sonner";
import ReactQueryProvider from "@/providers/react-query-provider";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import BifrostSidebar from "@/components/common/sidebar";
import Header from "@/components/common/header";
import { auth } from "@clerk/nextjs/server";
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
  const { orgId } = await auth();

  if (!orgId) {
    return <UnauthorizedPage />
  }

  return (
    <ClerkProvider>
      <html lang="no" suppressHydrationWarning>
        <body className={`antialiased ${interSans.className}`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ReactQueryProvider>
              <SidebarProvider>
                <BifrostSidebar />
                <SidebarInset>
                  <Header />
                  <main className='p-4 flex flex-col gap-4'>{children}</main>
                </SidebarInset>
              </SidebarProvider>
              <Toaster richColors position="top-center" />
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
