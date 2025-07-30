import { auth } from "@clerk/nextjs/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import EditResourceForm from "./edit-resource-form";
import { Id } from "@workspace/backend/convex/dataModel";

export default async function EditResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { orgRole } = await auth();
  const id = (await params).slug as Id<"resources">;

  if (!(orgRole === "org:admin" || orgRole === "org:editor")) {
    throw new Error("Forbidden");
  }

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/resources'>Ressurser</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Redigerer ressurs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <EditResourceForm id={id} />
    </>
  );
}
