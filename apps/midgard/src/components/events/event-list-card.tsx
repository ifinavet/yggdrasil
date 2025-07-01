import { CalendarDays, Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import getCompanyImageById from "@/lib/query/companies/getById";
import type { Tables } from "@/lib/supabase/database.types";
import {
  humanReadableDate,
  humanReadableDateTime,
  humanReadableTime,
} from "@/uitls/dateFormatting";

function getRegistrationStatus(event: Tables<"published_events_with_participation_count">) {
  const now = new Date();

  if (!event.registration_opens || !event.event_start) {
    return {
      registrationOpen: false,
      eventActive: false,
      statusMessage: "Ugyldig arrangementdata",
      cardColor: "border-zinc-400 bg-zinc-400",
    };
  }

  const registrationOpensDate = new Date(event.registration_opens);
  const eventStartDate = new Date(event.event_start);
  const participants = event.participants ?? 0;
  const participantsLimit = event.participants_limit ?? 0;

  const registrationOpen = registrationOpensDate <= now;
  const eventActive = registrationOpensDate < now && eventStartDate > now;

  const registrationOpenToday =
    registrationOpensDate.getFullYear() === now.getFullYear() &&
    registrationOpensDate.getMonth() === now.getMonth() &&
    registrationOpensDate.getDate() === now.getDate() &&
    registrationOpensDate.getHours() === now.getHours();

  let statusMessage = "";
  if (participants === participantsLimit) {
    statusMessage = "Påmeldingen er full";
  } else if (participants < participantsLimit) {
    statusMessage = "Det er fortsatt ledige plasser";
  } else if (registrationOpenToday) {
    statusMessage = "Påmeldingen er åpen";
  } else {
    statusMessage = `Påmeldingen åpner ${humanReadableDateTime(registrationOpensDate)}`;
  }

  return {
    registrationOpen,
    eventActive,
    statusMessage,
    cardColor: registrationOpen
      ? "border-emerald-700 bg-emerald-700"
      : "border-zinc-400 bg-zinc-400",
  };
}

function RegistrationStatusBanner({
  show,
  statusMessage,
  cardColor,
}: {
  show: boolean;
  statusMessage: string;
  cardColor: string;
}) {
  if (!show) return null;

  return (
    <div className='flex justify-end'>
      <p
        className={`w-fit ${cardColor} -mb-2 px-4 pt-4 pb-4 md:pb-0 rounded-t-md text-primary-foreground`}
      >
        {statusMessage}
      </p>
    </div>
  );
}

// Event details component
function EventDetails({ event }: { event: Tables<"published_events_with_participation_count"> }) {
  const participantsLimit = event.participants_limit ?? 0;

  return (
    <div className='md:col-span-5 text-zinc-100 py-4 flex flex-col gap-6 justify-between w-full px-4 md:px-0 sm:pr-4 lg:pr-32'>
      <EventHeader title={event.title} teaser={event.teaser} />
      {event.event_start && (
        <EventMetadata eventStart={event.event_start} participantsLimit={participantsLimit} />
      )}
    </div>
  );
}

// Event header component
function EventHeader({ title, teaser }: { title: string | null; teaser: string | null }) {
  return (
    <div className='grid gap-2 w-full'>
      <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
      <p className='scroll-m-20 text-lg font-medium tracking-tight'>{teaser}</p>
    </div>
  );
}

// Event metadata component
function EventMetadata({
  eventStart,
  participantsLimit,
}: {
  eventStart: string;
  participantsLimit: number;
}) {
  return (
    <div className='w-full flex flex-col gap-2 sm:flex-row justify-between font-semibold text-lg pb-2'>
      <div className='flex gap-2 items-center'>
        <CalendarDays className='size-6' />
        {humanReadableDate(new Date(eventStart))}
      </div>
      <div className='flex gap-2 items-center'>
        <Clock className='size-6' />
        {humanReadableTime(new Date(eventStart))}
      </div>
      <div className='flex gap-2 items-center'>
        <Users className='size-6' />
        {participantsLimit}
      </div>
    </div>
  );
}

// Company image component
function CompanyImage({ imageUrl, title }: { imageUrl?: string; title: string | null }) {
  return (
    <div className='h-full grid col-span-2 place-content-center px-6 py-4 bg-zinc-50 rounded-r-md'>
      <Image src={imageUrl || ""} alt={title ?? ""} width={200} height={200} />
    </div>
  );
}

// Main EventCard component
export default async function EventCard({
  event, isExternal
}: {
  event: Tables<"published_events_with_participation_count">;
  isExternal: boolean;
}) {
  if (!event.company_id || !event.registration_opens || !event.event_start) {
    return null;
  }

  const image = await getCompanyImageById(event.company_id);
  const { eventActive, statusMessage, cardColor } = getRegistrationStatus(event);

  return (
    <Link href={`/events/${event.event_id}`}>
      {!isExternal &&
        <RegistrationStatusBanner
          show={eventActive}
          statusMessage={statusMessage}
          cardColor={cardColor}
        />
      }
      <div
        className={`rounded-md min-h-52 border-3 overflow-hidden ${cardColor} grid md:grid-cols-7 gap-4 h-fit`}
      >
        <CompanyImage imageUrl={image?.url} title={event.title} />
        <EventDetails event={event} />
      </div>
    </Link>
  );
}
