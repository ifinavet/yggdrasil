"use client";

import { api } from "@workspace/backend/convex/api";
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
import { humanReadableDate } from "@/utils/utils";
import { useQuery } from "convex/react";

export default function pagesPage() {
	const pages = useQuery(api.externalPages.getAll);

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Ifinavet.no sider</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="flex justify-end">
				<Button asChild>
					<Link href="/pages/new-page">
						<Plus className="size-4" /> Opprett en ny side
					</Link>
				</Button>
			</div>

			<div className="flex flex-wrap gap-4">
				{pages?.map((page) => (
					<Link
						href={`/pages/${page._id}`}
						className="flex flex-col gap-6"
						key={page._id}
					>
						<Card>
							<CardHeader>
								<CardTitle>{page.title}</CardTitle>
								<CardDescription>
									{page.published ? "Publisert" : "Ikke publisert"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p>
									Sist oppdatert: {humanReadableDate(new Date(page.updatedAt))}
								</p>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</>
	);
}
