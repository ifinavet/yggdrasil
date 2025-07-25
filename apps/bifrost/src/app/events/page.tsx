import { api } from "@workspace/backend/convex/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { preloadQuery } from "convex/nextjs";
import { Plus } from "lucide-react";
import Link from "next/link";
import EventsGrid from "@/components/events/events-grid";
import SelectSemester from "@/components/events/select-semester";

export default async function Events() {

  const preloadedPossibleSemesters = await preloadQuery(api.events.getPossibleSemesters);

  return (
    <>
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
        <SelectSemester preloadedPossibleSemesters={preloadedPossibleSemesters} />
        <Button asChild>
          <Link href='/events/new-event'>
            <Plus className='size-4' /> Lag et nytt arrangement
          </Link>
        </Button>
      </div>

      <EventsGrid />
    </>
  );
}
