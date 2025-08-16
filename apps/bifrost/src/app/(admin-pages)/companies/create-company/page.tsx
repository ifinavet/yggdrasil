import { auth } from "@clerk/nextjs/server";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import Link from "next/link";
import CreateCompanyForm from "./create-company-form";

export default async function CreateCompany() {
	const { orgRole } = await auth();

	if (orgRole !== "org:admin") throw new Response("Forbidden", { status: 403 });

	return (
		<>
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
		</>
	);
}
