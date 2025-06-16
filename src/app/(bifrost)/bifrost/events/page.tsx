import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/utils/supabase/server";
import Link from "next/link";

export default async function Events() {
  const supabase = createServerClient();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_start", { ascending: true });

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/bifrost">Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Arrangementer</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex justify-between">
        <h1>Arrangementer</h1>
        <Button asChild>
          <Link href="/bifrost/events/new-event">Lag et nytt arrangement</Link>
        </Button>
      </div>

      {events ? (
        <ul>
          {events.map((event) => {
            return (
              <li key={event.event_id}>
                {event.title}: {event.description}
                <br />
                {new Date(event.event_start).toLocaleString()}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Ingen arrangementer funnet.</p>
      )}
    </>
  );
}
