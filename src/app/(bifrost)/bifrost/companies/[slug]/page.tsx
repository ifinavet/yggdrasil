import { auth } from "@clerk/nextjs/server";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import getCompanyImages from "@/lib/queries/bifrost/company/getCompanyImages";
import { getCompanyImage } from "@/lib/queries/bifrost/company/getCompanyImage";
import EditCompanyForm from "./edit-company-form";

export default async function CreateCompany({
  params,
}: {
  params: { slug: number };
}) {
  const { orgRole } = await auth();
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["company-image", params.slug],
    queryFn: () => getCompanyImage(params.slug),
  });

  if (orgRole !== "org:admin") throw new Response("Forbidden", { status: 403 });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link href="/bifrost">Hjem</Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link href="/bifrost/companies">Bedrifter</Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Administrer bedrift</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <EditCompanyForm company_id={params.slug} />
    </HydrationBoundary>
  );
}
