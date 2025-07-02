import { auth } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import Link from "next/link";
import { getCompanyById, getCompanyImageById } from "@/lib/queries/companies";
import EditCompanyForm from "./edit-company-form";

export default async function CreateCompany({ params }: { params: Promise<{ slug: number }> }) {
	const { orgRole } = await auth();
	const resolvedParams = await params;
	const queryClient = new QueryClient();

	await queryClient.prefetchQuery({
		queryKey: ["company-image", resolvedParams.slug],
		queryFn: () => getCompanyImageById(resolvedParams.slug),
	});

	await queryClient.prefetchQuery({
		queryKey: ["company", resolvedParams.slug],
		queryFn: () => getCompanyById(resolvedParams.slug),
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
			<EditCompanyForm company_id={resolvedParams.slug} />
		</HydrationBoundary>
	);
}
