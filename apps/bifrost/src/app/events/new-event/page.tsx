import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/backend/convex/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { fetchQuery } from "convex/nextjs";
import { getAllInternalMembers } from "@/lib/queries/organization";
import CreateEventForm from "./create-event-form";

export default async function NewEvent() {
  const { orgId, redirectToSignIn } = await auth();
  if (!orgId) return redirectToSignIn();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getAllInternalMembers(orgId),
  });

  await queryClient.prefetchQuery({
    queryKey: ["companies", orgId],
    queryFn: () => fetchQuery(api.companies.allCompanies, {}),
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
            <BreadcrumbLink href='/events'>Arrangementer</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Opprett et arrangement</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <CreateEventForm />
    </HydrationBoundary>
  );
}
