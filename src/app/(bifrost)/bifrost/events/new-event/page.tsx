import getCompanies from "@/app/(bifrost)/_queries/getCompanies";
import getInternalMembers from "@/app/(bifrost)/_queries/getInternalMembers";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { auth } from "@clerk/nextjs/server";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import CreateEventForm from "./create-event-form";

export default async function NewEvent() {
  const { orgId, redirectToSignIn } = await auth();
  if (!orgId) return redirectToSignIn();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  await queryClient.prefetchQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getInternalMembers(orgId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost">Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost/events">
              Arrangementer
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Opprett et arrangement</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <CreateEventForm orgId={orgId} />
    </HydrationBoundary>
  );
}
