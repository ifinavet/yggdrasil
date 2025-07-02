import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getAllPages } from "@/lib/queries/pages";
import { humanReadableDate } from "@/utils/utils";

export default async function pagesPage() {
	try {
		const pages = await getAllPages();
		return (
			<>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>Ifinavet.no sider</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>

				<div className='flex justify-end'>
					<Button asChild>
						<Link href='/pages/new-page'>
							<Plus className='size-4' /> Opprett en ny side
						</Link>
					</Button>
				</div>

				<div className='flex flex-wrap gap-4'>
					{pages.map((page) => (
						<Link
							href={`/pages/${page.page_id}`}
							className='flex flex-col gap-6'
							key={page.page_id}
						>
							<Card>
								<CardHeader>
									<CardTitle>{page.title}</CardTitle>
									<CardDescription>
										{page.published ? "Publisert" : "Ikke publisert"}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p>Sist oppdatert: {humanReadableDate(new Date(page.updated_at || ""))}</p>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</>
		);
	} catch (error) {
		return (
			<>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>Ifinavet.no sider</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>

				<div className='flex justify-end'>
					<Button asChild>
						<Link href='/pages/new-page'>
							<Plus className='size-4' /> Opprett en ny side
						</Link>
					</Button>
				</div>

				<h1>Error</h1>
				<p>Failed to fetch pages</p>
				<small className='font-medium text-sm leading-none'>{(error as Error).message}</small>
			</>
		);
	}
}
