import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import Link from "next/link";
import CreateCompanyForm from "./create-company-form";

export default async function CreateCompany() {
	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<Link href="/">Hjem</Link>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<Link href="/companies">Bedrifter</Link>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>Legg til en ny bedrift</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<CreateCompanyForm />
		</>
	);
}
