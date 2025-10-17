import { SidebarInset } from "@workspace/ui/components/sidebar";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import Header from "@/components/common/header";
import BifrostSidebar from "@/components/common/sidebar/sidebar";
import { hasBasicRights } from "@/lib/auth/rights";
import PostHogPageView from "../posthog-page-view";

export default async function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const hasRight = await hasBasicRights();

	if (!hasRight) return redirect("/unauthorized");

	return (
		<>
			<BifrostSidebar />
			<SidebarInset className="max-h-full">
				<Header />
				<main className="flex max-h-full flex-col gap-4 p-4">{children}</main>
			</SidebarInset>
			<Toaster richColors position="top-center" />
			<Suspense fallback={null}>
				<PostHogPageView />
			</Suspense>
		</>
	);
}
