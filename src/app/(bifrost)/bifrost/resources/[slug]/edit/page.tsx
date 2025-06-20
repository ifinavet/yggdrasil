import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import EditResourceForm from "./edit-resource-form";
import getEvent from "@/lib/queries/bifrost/event/getEvent";
import getResource from "@/lib/queries/bifrost/resource/getResource";
import { auth } from "@clerk/nextjs/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function EditResourcePage({
  params,
}: {
  params: { slug: number };
}) {
  const { orgRole } = await auth();
  const queryClient = new QueryClient();
  const id = params.slug;

  await queryClient.prefetchQuery({
    queryKey: ["resource", id],
    queryFn: () => getResource(id),
  });

  if (!(orgRole === "org:admin" || orgRole === "org:editor")) {
    throw new Error("Forbidden");
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost">Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost/resources">Ressurser</BreadcrumbLink>
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
