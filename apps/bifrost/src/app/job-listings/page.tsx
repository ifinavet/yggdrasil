import { api } from "@workspace/backend/convex/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { fetchQuery } from "convex/nextjs";
import { Plus } from "lucide-react";
import Link from "next/link";
import { createColumns } from "@/components/job-listings/listings-table/columns";
import { ListingsTable } from "@/components/job-listings/listings-table/listings-table";
import { groupJobListings, type JobListing } from "@/utils/job-listings";

export default async function JobListingsPage() {
  const listings = await fetchQuery(api.listings.getAll, {});

  const data: JobListing[] = listings.map((listing) => ({
    listingId: listing._id,
    title: listing.title,
    type: listing.type,
    companyName: listing.companyName,
    deadline: new Date(listing.deadline),
    published: listing.published,
  }));

  const groupedListings = groupJobListings(data);

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

      <Tabs defaultValue='published' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='published'>
            Publiserte ({groupedListings.published.deadlineNotPassed.length})
          </TabsTrigger>
          <TabsTrigger value='unpublished'>
            Upubliserte ({groupedListings.unpublished.deadlineNotPassed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='published' className='mt-6'>
          <div className='space-y-8'>
            {groupedListings.published.deadlineNotPassed.length > 0 && (
              <div>
                <h3 className='mb-4 font-semibold text-lg'>Aktive publiserte stillingsannonser</h3>
                <ListingsTable
                  data={groupedListings.published.deadlineNotPassed}
                  columns={createColumns}
                  empty_message='Ingen aktive Publiserte stillingsannonser funnet'
                />
              </div>
            )}

            {/* Unpublished Listings - Deadline Passed */}
            {groupedListings.published.deadlinePassed.length > 0 && (
              <div>
                <h3 className='mb-4 font-semibold text-lg'>Utløpte publiserte stillingsannonser</h3>
                <ListingsTable
                  data={groupedListings.published.deadlinePassed}
                  columns={createColumns}
                  empty_message='Ingen utløpte Publiserte stillingsannonser funnet'
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value='unpublished' className='mt-6'>
          <div className='space-y-8'>
            {/* Unpublished Listings - Deadline Not Passed */}
            {groupedListings.unpublished.deadlineNotPassed.length > 0 && (
              <div>
                <h3 className='mb-4 font-semibold text-lg'>Aktive upubliserte stillingsannonser</h3>
                <ListingsTable
                  data={groupedListings.unpublished.deadlineNotPassed}
                  columns={createColumns}
                  empty_message='Ingen aktive upubliserte stillingsannonser funnet'
                />
              </div>
            )}

            {/* Unpublished Listings - Deadline Passed */}
            {groupedListings.unpublished.deadlinePassed.length > 0 && (
              <div>
                <h3 className='mb-4 font-semibold text-lg'>
                  Utløpte upubliserte stillingsannonser
                </h3>
                <ListingsTable
                  data={groupedListings.unpublished.deadlinePassed}
                  columns={createColumns}
                  empty_message='Ingen utløpte upubliserte stillingsannonser funnet'
                />
              </div>
            )}

            {/* Show message if no unpublished listings */}
            {groupedListings.unpublished.deadlineNotPassed.length === 0 &&
              groupedListings.unpublished.deadlinePassed.length === 0 && (
                <div className='py-8 text-center'>
                  <p className='text-muted-foreground'>
                    Ingen upubliserte stillingsannonser funnet
                  </p>
                </div>
              )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
