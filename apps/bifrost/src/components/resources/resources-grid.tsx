import { auth } from "@clerk/nextjs/server";
import { api } from "@workspace/backend/convex/api";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components//card";
import { fetchQuery } from "convex/nextjs";
import { Pencil } from "lucide-react";
import Link from "next/link";

export default async function ResourcesGrid() {
	const resources = await fetchQuery(api.resources.getAllGroupedByTag);
	const { orgRole } = await auth();

	return (
		<div className='mx-4 flex flex-col gap-4'>
			{Object.entries(resources.groupedByTag).map(([tag, resources]) => (
				<div key={tag} className='flex flex-col gap-4'>
					<h4 className='scroll-m-20 font-semibold text-xl capitalize tracking-tight'>{tag}</h4>
					<div className='grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
						{resources.map((resource) => (
							<Link href={`/resources/${resource._id}`} key={resource._id}>
								<Card
									key={resource._id}
									className='overflow-hidden border-0 py-0 pb-6 shadow-sm transition-shadow hover:shadow-md'
								>
									<div className='relative h-28 bg-gradient-to-r from-sky-400 to-blue-800'>
										<div className='-bottom-4 absolute left-6'>
											<div className='flex size-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg dark:bg-gray-200'>
												<Pencil className='size-6 text-white dark:text-black' />
											</div>
										</div>
									</div>
									<CardHeader className='pt-6'>
										<CardTitle className='font-semibold text-accent-foreground text-xl'>
											{resource.title}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<CardDescription className='text-primary leading-relaxed'>
											{resource.excerpt}
										</CardDescription>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				</div>
			))}

			{resources.unpublishedResources.length > 0 &&
				(orgRole === "org:admin" || orgRole === "org:editor") && (
					<div className='flex flex-col gap-4'>
						<h4 className='scroll-m-20 font-semibold text-xl tracking-tight'>
							Upubliserte ressurser
						</h4>
						<div className='grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
							{resources.unpublishedResources.map((resource) => (
								<Link href={`/resources/${resource._id}/edit`} key={resource._id}>
									<Card
										key={resource._id}
										className='overflow-hidden border-0 py-0 pb-6 shadow-sm transition-shadow hover:shadow-md'
									>
										<div className='relative h-28 bg-gradient-to-r from-sky-400 to-blue-800'>
											<div className='-bottom-4 absolute left-6'>
												<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-lg'>
													<Pencil className='h-6 w-6 text-white' />
												</div>
											</div>
										</div>
										<CardHeader className='pt-8 pb-2'>
											<CardTitle className='font-semibold text-gray-900 text-xl'>
												{resource.title}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<CardDescription className='text-gray-600 leading-relaxed'>
												{resource.excerpt}
											</CardDescription>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</div>
				)}
		</div>
	);
}
