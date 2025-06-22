import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import Link from "next/link";
import getAllCompanyImages from "@/lib/queries/companies/getAllImages";
import CreateCompanyForm from "./create-company-form";

export default async function CreateCompany() {
  const { orgRole } = await auth();
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["company-images", 0],
    queryFn: () => getAllCompanyImages({ pageParam: 0 }),
  });

  if (orgRole !== "org:admin") throw new Response("Forbidden", { status: 403 });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
          <BreadcrumbItem>Legg til en ny bedrift</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <CreateCompanyForm />
    </HydrationBoundary>
  );
}
