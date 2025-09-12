import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { preloadQuery } from "convex/nextjs";
import EditPageForm from "./edit-page-form";

export default async function EditResourcePage({
	params,
}: Readonly<{ params: Promise<{ slug: Id<"externalPages"> }> }>) {
	const { slug: id } = await params;

	const preloadedPage = await preloadQuery(api.externalPages.getById, { id });

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/pages">Sider</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Redigerer side</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<EditPageForm preloadedPage={preloadedPage} />
		</>
	);
}
