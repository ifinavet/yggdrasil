import { hasAdminRights } from "@workspace/auth";
import { redirect } from "next/navigation";

export default async function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	const hasRight = await hasAdminRights();

	return hasRight ? children : redirect("/");
}
