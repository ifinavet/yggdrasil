import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { toast } from "sonner";

export default async function Layout({ children }: { children: React.ReactNode }) {
	const { orgRole } = await auth();

	if (!orgRole || !["org:admin", "org:editor"].includes(orgRole)) {
		toast.warning("Du har ikke tilgang til denne siden");
		redirect("/");
	}

	return children;
}
