"use client";

import type { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import { CalendarDays, Globe, IdCard, MapPin, Users, Utensils } from "lucide-react";
import { humanReadableDateTime } from "@/uitls/dateFormatting";
import RegistrationButton from "./registration/registration-button";
import WaitlistPosition from "./registration/waitlist-position";

export function EventMetadata({
  preloadedEvent,
  preloadedRegistrations,
}: {
  preloadedEvent: Preloaded<typeof api.events.getById>;
  preloadedRegistrations: Preloaded<typeof api.registration.getByEventId>;
}) {
  const event = usePreloadedQuery(preloadedEvent);
  const registrations = usePreloadedQuery(preloadedRegistrations);

  const availableSpots = event.participationLimit - (registrations.registered.length || 0);

  return (
    <div>
      <div className="grid h-80 grid-cols-2 grid-rows-3 items-center justify-start gap-4 hyphens-auto rounded-xl bg-primary px-10 py-6 text-primary-foreground md:px-16 md:py-8">
        <p className='flex items-center gap-2 text-pretty font-semibold md:text-lg'>
          <CalendarDays className='size-6 min-w-6 md:size-8' />{" "}
          {humanReadableDateTime(new Date(event.eventStart))}
        </p>
        <p className='flex items-center gap-2 font-semibold md:text-lg'>
          <MapPin className='size-6 min-w-6 md:size-8' /> {event.location}
        </p>
        <p className='flex items-center gap-2 font-semibold md:text-lg'>
          <Utensils className='size-6 min-w-6 md:size-8' /> {event.food}
        </p>
        <p className='flex items-center gap-2 font-semibold md:text-lg'>
          <Users className='size-6 min-w-6 md:size-8' /> {availableSpots} plasser igjen
        </p>
        <p className='flex items-center gap-2 font-semibold md:text-lg'>
          <Globe className='size-6 min-w-6 md:size-8' /> {event.language}
        </p>
        <p className='flex items-center gap-2 break-words font-semibold md:text-lg'>
          <IdCard className='size-6 min-w-6 md:size-8' /> {event.ageRestriction}
        </p>
      </div>
      <div className='-mt-8 mb-6 flex justify-center'>
        {typeof event.externalUrl === "string" && event.externalUrl.length > 0 ? (
          <Button
            type='button'
            className='w-3/5 rounded-xl bg-orange-500 py-8 text-lg hover:cursor-pointer hover:bg-orange-600'
            asChild
          >
            <a href={event.externalUrl} target='_blank' rel='noopener noreferrer'>
              Gå til arrangementets nettsted
            </a>
          </Button>
        ) : event.registrationOpens > Date.now() ? (
          <Button
            type='button'
            className='w-3/4 whitespace-normal text-balance rounded-xl bg-zinc-500 py-8 text-lg hover:cursor-pointer hover:bg-zinc-500'
          >
            Påmelding åpner {humanReadableDateTime(new Date(event.registrationOpens))}
          </Button>
        ) : (
          <RegistrationButton
            eventId={event._id}
            registration={registrations}
            availableSpots={availableSpots}
          />
        )}
      </div>
      <WaitlistPosition className='mb-6' registrations={registrations} />
    </div>
  );
}
