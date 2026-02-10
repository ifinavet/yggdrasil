import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components//breadcrumb";
import { Button } from "@workspace/ui/components//button";
import { ChartPie, Pencil, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

export default async function Layout({
  children,
}: Readonly<{
  readonly children: React.ReactNode;
}>) {
  const path = (await headers()).get("x-pathname")?.split("/");
  if (!path) {
    throw new Error("Invalid path");
  }

  const event_id = path?.[2] ?? "";
  if (!event_id) {
    throw new Error("Invalid event ID");
  }

  return (
    <>
      <div className="flex flex-wrap justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Hjem</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/events">Arrangementer</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Administrer arrangementet</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex gap-4">
          <Button asChild variant="link" className="text-foreground">
            <Link href={`/events/${event_id}`}>
              <Pencil className="size-4" /> Rediger og Administer
            </Link>
          </Button>
          <Button asChild variant="link" className="text-foreground">
            <Link href={`/events/${event_id}/registrations`}>
              <Users className="size-4" /> Påmeldte
            </Link>
          </Button>
          <Button asChild variant="link" className="text-foreground">
            <Link href={`/events/${event_id}/report`}>
              <ChartPie className="size-4" /> Rapport
            </Link>
          </Button>
        </div>
      </div>

      {children}
    </>
  );
}
