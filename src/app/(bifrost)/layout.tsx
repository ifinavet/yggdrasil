import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Header from "@/components/bifrost/header";
import BifrostSidebar from "@/components/bifrost/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import ReactQueryProvider from "@/lib/react-query-provider";

export const metadata = {
	title: "Bifrost",
};

export default async function Layout({ children }: { children: React.ReactNode }) {
	return (
		<ReactQueryProvider>
			<SidebarProvider>
				<BifrostSidebar />
				<SidebarInset>
					<Header />
					<main className='p-4 flex flex-col gap-4'>{children}</main>
				</SidebarInset>
				<ReactQueryDevtools initialIsOpen={false} />
			</SidebarProvider>
		</ReactQueryProvider>
	);
}
