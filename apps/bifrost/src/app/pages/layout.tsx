import { redirect } from "next/navigation";
import { hasEditRights } from "@/utils/auth";

export default async function Layout({
	children,
}: Readonly<{
	readonly children: React.ReactNode;
}>) {
	return (await hasEditRights()) ? children : redirect("/");
}
