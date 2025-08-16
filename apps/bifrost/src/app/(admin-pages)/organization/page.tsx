import { api } from "@workspace/backend/convex/api";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { preloadQuery } from "convex/nextjs";
import AddBoardMember from "@/components/organization/add-boardmember";
import ListBoardMembers from "@/components/organization/list-board-members";

export default async function OrganizationPage() {
	const preloadedBoardMembers = await preloadQuery(api.internals.getTheBoard);

	return (
		<>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Organisasjon</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className='grid gap-6'>
				<h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
					Styret
				</h2>
				<AddBoardMember className='w-fit justify-self-end' />
				<ListBoardMembers preloadedBoardMembers={preloadedBoardMembers} />

				<Separator />
				<h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
					Hovedsamarbeidspartner
				</h2>
			</div>
		</>
	);
}
