import { redirect } from "next/navigation";
import { hasAdminRights } from "@/utils/auth";

export default async function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	const hasRight = await hasAdminRights();

	return hasRight ? children : redirect("/");
}
