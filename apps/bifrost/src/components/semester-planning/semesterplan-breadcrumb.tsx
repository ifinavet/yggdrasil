import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Fragment } from "react";

/** Hjem › Semesterplan › each step of `trail`; the last step is the current page. */
export function SemesterplanBreadcrumb({
	trail = [],
}: Readonly<{ trail?: { label: string; href?: string }[] }>) {
	const steps = [{ label: "Semesterplan", href: "/semesterplan" }, ...trail];
	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
				</BreadcrumbItem>
				{steps.map((step, index) => (
					<Fragment key={step.label}>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{index === steps.length - 1 || !step.href ? (
								<BreadcrumbPage>{step.label}</BreadcrumbPage>
							) : (
								<BreadcrumbLink href={step.href}>{step.label}</BreadcrumbLink>
							)}
						</BreadcrumbItem>
					</Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
