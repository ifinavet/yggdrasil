import { URLSearchParams } from "node:url";
import { clerkClient } from "@clerk/nextjs/server";
import { Badge } from "@workspace/ui/components//badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components//card";
import { Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getEvents } from "@/lib/queries/event/getEvents";
import { humanReadableDate } from "@/lib/utils";
import { OrganizerType } from "@/shared/enums";
import { createServerClient } from "@/utils/supabase/server";

export default async function EventsGrid() {
	const pathname = (await headers()).get("x-searchParams");
	let searchParams: URLSearchParams | undefined;
	if (pathname) searchParams = new URLSearchParams(pathname);

	const year = searchParams?.get("year") || new Date().getFullYear().toString();
	const semester = searchParams?.get("semester") || (new Date().getMonth() < 6 ? "vår" : "høst");

	const events = await getEvents({ year: Number.parseInt(year), semester });

	return (
		<div className='grid  gap-6'>
			{events?.published?.length || events?.unpublished?.length ? (
				<>
					<h2 className='scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0'>
						Publiserte arrangementer
					</h2>
					<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
						{events?.published?.map((event) => (
							<EventCard
								key={event.event_id}
								event_id={event.event_id}
								title={event.title}
								company_id={event.companies.company_id}
								date={event.event_start}
								is_published={event.published}
								external_url={event.external_url ?? ""}
							/>
						))}
					</div>
					<h2 className='scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0'>
						Skjulte/Påbegynte arrangementer
					</h2>
					<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
						{events?.unpublished?.map((event) => (
							<EventCard
								key={event.event_id}
								event_id={event.event_id}
								title={event.title}
								company_id={event.companies.company_id}
								date={event.event_start}
								is_published={event.published}
								external_url={event.external_url ?? ""}
							/>
						))}
					</div>
				</>
			) : (
				<p>Vi fant ingen arrangementer</p>
			)}
		</div>
	);
}

async function EventCard({
	title,
	event_id,
	company_id,
	date,
	is_published,
	external_url,
}: {
	title: string;
	event_id: number;
	company_id: number;
	date: string;
	is_published: boolean;
	external_url?: string;
}) {
	const supabase = createServerClient();
	const clerk = await clerkClient();

	const { data: organizers } = await supabase
		.from("event_organizers")
		.select("*")
		.eq("event_id", event_id);

	const { data: company } = await supabase
		.from("companies")
		.select("*")
		.eq("company_id", company_id)
		.single();

	const organizerComponents = await Promise.all(
		organizers?.map(async (organizer) => {
			const user = await clerk.users.getUser(organizer.user_id);
			return (
				<h3 key={organizer.user_id}>
					<span className='font-semibold'>
						{OrganizerType[organizer.role as keyof typeof OrganizerType]}:{" "}
					</span>
					{user.fullName}
				</h3>
			);
		}) || [],
	);

	const is_external = !(external_url === undefined || external_url === "");

	return (
		<Link href={`/events/${event_id}`} className='flex flex-col gap-6'>
			<Card className='h-full'>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					<CardDescription>{humanReadableDate(new Date(date))}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4 flex-1'>
					<div className='flex flex-row gap-2 flex-wrap'>
						{company && (
							<h3>
								<span className='font-semibold'>Bedrift:</span> {company.company_name}
							</h3>
						)}
					</div>
					<div className='flex gap-2 flex-wrap'>
						{is_external && <Badge>Externt arrangement</Badge>}
						{!is_published && <Badge variant='secondary'>Avpublisert</Badge>}
					</div>
				</CardContent>
				<CardFooter className='flex-col items-start gap-1.5 text-sm'>
					<div className='line-clamp-1 flex gap-2 font-medium'>
						<Users className='size-4' /> Ansvarlige
					</div>
					<div className='text-muted-foreground'>{organizerComponents}</div>
				</CardFooter>
			</Card>
		</Link>
	);
}
