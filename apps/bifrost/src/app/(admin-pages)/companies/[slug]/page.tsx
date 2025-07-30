import { auth } from "@clerk/nextjs/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import Link from "next/link";
import EditCompanyForm from "./edit-company-form";
import { Id } from "@workspace/backend/convex/dataModel";

export default async function CreateCompany({ params }: { params: Promise<{ slug: Id<"companies"> }> }) {
  const { orgRole } = await auth();
  const resolvedParams = await params;

  if (orgRole !== "org:admin") throw new Response("Forbidden", { status: 403 });

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link href='/'>Hjem</Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link href='/companies'>Bedrifter</Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Administrer bedrift</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <EditCompanyForm company_id={resolvedParams.slug} />
    </>
  );
}
