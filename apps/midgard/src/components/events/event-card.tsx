import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import { CalendarDays, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { humanReadableDate } from "@/utils/dateFormatting";

export default async function EventCard({ event }: { event: Doc<"events"> }) {
	const company = await fetchQuery(api.companies.getById, { id: event.hostingCompany });

	return (
		<Link href={`/events/${event._id}`} className='h-full'>
			<div className='flex h-100 flex-col overflow-clip rounded-lg border border-primary/10 shadow-md'>
				<div className='relative grid h-32 place-content-center px-8 py-6 md:h-48 lg:h-52'>
					<Image
						src={company.imageUrl}
						alt={event.title}
						className='object-contain p-6'
						sizes='50vw'
						fill
					/>
				</div>
				<div className='flex flex-1 flex-col justify-between bg-primary p-6 text-primary-foreground'>
					<div className='flex flex-col gap-4'>
						<h2 className='font-bold text-xl tracking-tight'>{event.title}</h2>
						<p className='line-clamp-2 truncate whitespace-normal'>{event.teaser}</p>
					</div>
					<div className='flex flex-col justify-center gap-4 sm:flex-row'>
						<p className='flex gap-2'>
							<Users /> {event.participationLimit}
						</p>
						<p className='flex gap-2'>
							<CalendarDays /> {humanReadableDate(new Date(event.eventStart))}
						</p>
					</div>
				</div>
			</div>
		</Link>
	);
}
