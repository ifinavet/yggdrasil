import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import Header from "@/components/header";
import BifrostSidebar from "@/components/sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<BifrostSidebar />
			<SidebarInset>
				<Header />
				<main className='p-4 flex flex-col gap-4'>{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
