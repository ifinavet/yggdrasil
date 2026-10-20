import { getAuthToken, hasEditRights } from "@workspace/auth";
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
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import EditResourceForm from "./edit-resource-form";

export default async function EditResourcePage({
	params,
}: Readonly<{
	params: Promise<{ slug: Id<"resources"> }>;
}>) {
	const { slug: id } = await params;

	const token = await getAuthToken();
	const resource = await fetchQuery(api.pages.queries.getResourceById, { id }, { token });
	if (resource.slug) redirect(`/wiki/${resource.slug}/edit`);

	if (!(await hasEditRights())) redirect("/");

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/resources">Ressurser</BreadcrumbLink>
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
