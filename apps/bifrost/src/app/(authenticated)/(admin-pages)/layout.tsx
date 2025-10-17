import { redirect } from "next/navigation";
import { hasAdminRights } from "@/lib/auth/rights";

export default async function Layout({
	children,
}: {
	children: React.ReactNode;
}) {
	const hasRight = await hasAdminRights();

	return hasRight ? children : redirect("/");
}
