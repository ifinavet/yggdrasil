import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { INVOICE_ROUTES } from "./invoice-routes";

export function InvoicingBreadcrumb({ current }: Readonly<{ current?: string }>) {
	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{current ? (
						<BreadcrumbLink href={INVOICE_ROUTES.list}>Fakturaer</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Fakturaer</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{current && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{current}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
