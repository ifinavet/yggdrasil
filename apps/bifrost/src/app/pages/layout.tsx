import { hasEditRights } from "@workspace/auth";
import { redirect } from "next/navigation";

export default async function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (await hasEditRights()) ? children : redirect("/");
}
