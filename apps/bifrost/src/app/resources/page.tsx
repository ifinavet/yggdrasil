import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Plus } from "lucide-react";
import Link from "next/link";
import ResourcesGrid from "@/components/resources/resources-grid";

export default async function Resources() {
	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Ressurser</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className='flex justify-end'>
				<Button asChild>
					<Link href='/resources/new-resource'>
						<Plus className='size-4' /> Lag en ny ressurs
					</Link>
				</Button>
			</div>

			<ResourcesGrid />
		</>
	);
}
