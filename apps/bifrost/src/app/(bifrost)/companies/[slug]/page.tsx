import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import Link from "next/link";
import { getCompanyImage } from "@/lib/queries/company/getCompanyImage";
import EditCompanyForm from "./edit-company-form";

export default async function CreateCompany({ params }: { params: { slug: number } }) {
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
			<EditCompanyForm company_id={params.slug} />
		</HydrationBoundary>
	);
}
