import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@workspace/ui/components/sonner";
import { eina } from "@/components/common/eina-font";
import Footer from "@/components/common/footer";
import Header from "@/components/common/header/header";
import ReactQueryProvider from "@/providers/react-query-provider";

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
        <html lang='no'>
          <body className={`${eina.className} antialiased flex flex-col h-screen`}>
            <Header />
            <main className='flex-1 mb-12'>{children}</main>
            <Footer />
            <Toaster />
          </body>
        </html>
      </ReactQueryProvider>
    </ClerkProvider>
  );
}
