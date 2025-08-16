import { auth } from "@clerk/nextjs/server";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import EditResourceForm from "./edit-resource-form";

export default async function EditResourcePage({
	params,
}: {
	params: Promise<{ slug: Id<"resources"> }>;
}) {
	const { orgRole } = await auth();
	const { slug: id } = await params;

	if (!(orgRole === "org:admin" || orgRole === "org:editor")) {
		throw new Error("Forbidden");
	}

	return (
		<>
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
		</>
	);
}
