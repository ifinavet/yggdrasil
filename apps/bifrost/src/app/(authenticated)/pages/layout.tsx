import { redirect } from "next/navigation";
import { hasEditRights } from "@/utils/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
	return (await hasEditRights()) ? children : redirect("/");
}
