import type { Id } from "@workspace/backend/convex/dataModel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import Link from "next/link";
import { Suspense } from "react";
import EditCompanyForm from "./edit-company-form";

type Props = Readonly<{
	params: Promise<{ slug: Id<"companies"> }>;
}>;

export default function CreateCompany(props: Props) {
	return (
		<Suspense fallback={null}>
			<EditCompany {...props} />
		</Suspense>
	);
}

async function EditCompany({ params }: Props) {
	const { slug: id } = await params;

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
					<BreadcrumbItem>Administrer bedrift</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<EditCompanyForm company_id={id} />
		</>
	);
}
