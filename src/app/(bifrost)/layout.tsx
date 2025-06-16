import Header from "@/components/bifrost/header";
import BifrostSidebar from "@/components/bifrost/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata = {
  title: "Bifrost",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <BifrostSidebar />
      <SidebarInset>
        <Header />
        <main className="p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
