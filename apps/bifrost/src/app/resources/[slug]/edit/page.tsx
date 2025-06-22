import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import EditResourceForm from "./edit-resource-form";
import { getResourceById } from "@/lib/queries/resources";

export default async function EditResourcePage({ params }: { params: { slug: number } }) {
  const { orgRole } = await auth();
  const queryClient = new QueryClient();
  const id = params.slug;

  if (!(orgRole === "org:admin" || orgRole === "org:editor")) {
    throw new Error("Forbidden");
  }

  await queryClient.prefetchQuery({
    queryKey: ["resource", id],
    queryFn: () => getResourceById(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
    </HydrationBoundary>
  );
}
