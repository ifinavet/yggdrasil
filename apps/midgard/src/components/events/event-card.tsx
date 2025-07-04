import { CalendarDays, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import getCompanyImageById from "@/lib/query/companies/getById";
import type { Tables } from "@/lib/supabase/database.types";
import { humanReadableDate } from "@/uitls/dateFormatting";

export default async function EventCard({ event }: { event: Tables<"events"> }) {
  const companyImage = await getCompanyImageById(event.company_id);

  return (
    <Link href={`/events/${event.event_id}`}>
      <div className='flex h-100 flex-col overflow-clip rounded-lg border border-primary/10 shadow-md'>
        <div className='grid h-32 place-content-center px-8 py-6 md:h-48 lg:h-52'>
          <div className='max-h-24 object-contain md:max-h-32'>
            <Image
              src={companyImage?.url ?? ""}
              width={200}
              height={200}
              alt={event.title}
              className='h-full'
            />
          </div>
        </div>
        <div className='flex flex-1 flex-col justify-between bg-primary p-6 text-primary-foreground'>
          <div className='flex flex-col gap-4'>
            <h2 className='font-bold text-xl tracking-tight'>{event.title}</h2>
            <p>{event.teaser}</p>
          </div>
          <div className='flex flex-col justify-center gap-4 sm:flex-row'>
            <p className='flex gap-2'>
              <Users /> {event.participants_limit}
            </p>
            <p className='flex gap-2'>
              <CalendarDays /> {humanReadableDate(new Date(event.event_start))}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
