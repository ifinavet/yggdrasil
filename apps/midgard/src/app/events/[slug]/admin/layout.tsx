import { auth } from "@clerk/nextjs/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
	const { orgId } = await auth();
	if (orgId !== process.env.NAVET_ORG_ID) throw new Error("Unauthorized access");

	return children;
}
