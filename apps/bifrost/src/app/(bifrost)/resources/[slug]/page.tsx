import { auth } from "@clerk/nextjs/server";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Separator } from "@workspace/ui/components//separator";
import Link from "next/link";
import SafeHtml from "@/components/sanitize-html";
import getResource from "@/lib/queries/resource/getResource";

export default async function ResourcePage({ params }: { params: { slug: number } }) {
	const { orgRole } = await auth();
	const resource = await getResource(params.slug);

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href='/resources'>Ressurser</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{resource.title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className='flex flex-col-reverse gap-4 md:flex-row'>
				<h1 className='flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance'>
					{resource.title}
				</h1>
				{(orgRole === "org:admin" || orgRole === "org:editor") && (
					<Button variant='outline' asChild className='w-fit self-end md:self-auto'>
						<Link href={`/resources/${resource.resource_id}/edit`}>Rediger</Link>
					</Button>
				)}
			</div>
			<Separator className='my-4' />
			<SafeHtml
				className='prose dark:prose-invert mx-auto mt-8 px-4 max-w-[80ch]'
				html={resource.content}
			/>
		</>
	);
}
