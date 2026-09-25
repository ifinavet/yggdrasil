import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { PRODUCT_ROUTES } from "./product-routes";

export function ProductsBreadcrumb({ current }: Readonly<{ current?: string }>) {
	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{current ? (
						<BreadcrumbLink href={PRODUCT_ROUTES.list}>Produkter</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Produkter</BreadcrumbPage>
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
