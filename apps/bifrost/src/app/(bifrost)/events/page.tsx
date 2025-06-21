import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
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
import { getEvents, getPossibleSemestes } from "@/lib/queries/event/getEvents";
import EventsGrid from "./events";
import SelectSemester from "./select-semester";

export default async function Events() {
	const queryClient = new QueryClient();

	const year = new Date().getFullYear();
	const semester = new Date().getMonth() < 6 ? "vår" : "høst";

	await queryClient.prefetchQuery({
		queryKey: ["possible_semesters"],
		queryFn: getPossibleSemestes,
	});

	await queryClient.prefetchQuery({
		queryKey: ["events", { year, semester }],
		queryFn: () => getEvents({ year, semester }),
	});

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Arrangementer</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className='flex justify-between'>
				<SelectSemester />
				<Button asChild>
					<Link href='/events/new-event'>
						<Plus className='size-4' /> Lag et nytt arrangement
					</Link>
				</Button>
			</div>

			<EventsGrid />
		</HydrationBoundary>
	);
}
