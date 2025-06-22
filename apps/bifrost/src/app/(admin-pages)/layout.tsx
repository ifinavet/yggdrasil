import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { orgRole } = await auth();

  if (orgRole !== "org:admin") {
    return redirect("/");
  }

  return children;
}
