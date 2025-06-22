import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { createColumns, type JobListing } from "@/components/job-listings/listings-table/columns";
import { ListingsTable } from "@/components/job-listings/listings-table/listings-table";
import getAllJobListings from "@/lib/queries/job-listings/getAll";

export default async function JobListingsPage() {
  const listings = await getAllJobListings();

  const data: JobListing[] = listings.map((listing) => ({
    listing_id: listing.listing_id,
    title: listing.title,
    deadline: new Date(listing.deadline),
  }));


  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'>Hjem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Stillingsannonser</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex justify-end'>
        <Button asChild>
          <Link href='/job-listings/new-listing'>
            <Plus className='size-4' /> Opprett en ny stillingsannonse
          </Link>
        </Button>
      </div>

      <ListingsTable data={data} columns={createColumns} />
    </>
  );
}
