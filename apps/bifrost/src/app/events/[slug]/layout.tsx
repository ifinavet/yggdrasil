import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { Pencil, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname")?.split("/");
  if (!path) {
    throw new Error("Invalid path");
  }

  const event_id = Number.parseInt(path?.[2] ?? "");
  if (!event_id) {
    throw new Error("Invalid event ID");
  }

  return (
    <>
      <div className='flex justify-between flex-wrap'>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href='/events'>Arrangementer</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Administrer arrangementet</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className='flex gap-4'>
          <Button asChild variant='link'>
            <Link href={`/events/${event_id}`}>
              <Pencil className='sie-4' /> Rediger og Administer
            </Link>
          </Button>
          <Button asChild variant='link'>
            <Link href={`/events/${event_id}/registrations`}>
              <Users className='sie-4' /> Påmeldte
            </Link>
          </Button>
        </div>
      </div>

      {children}
    </>
  );
}
