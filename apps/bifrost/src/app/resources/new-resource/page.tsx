import { hasEditRights } from "@workspace/auth";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import NewResourceForm from "./new-resource-form";

export default function NewResourcePage() {
	return (
		<Suspense fallback={null}>
			<NewResource />
		</Suspense>
	);
}

async function NewResource() {
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
						<BreadcrumbPage>Ny ressurs</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<NewResourceForm />
		</>
	);
}
