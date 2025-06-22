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
import { Plus } from "lucide-react";
import Link from "next/link";
import { createColumns } from "@/components/job-listings/listings-table/columns";
import { ListingsTable } from "@/components/job-listings/listings-table/listings-table";
import getAllJobListings from "@/lib/queries/job-listings/getAll";
import { groupJobListings, type JobListing } from "@/utils/job-listings";

export default async function JobListingsPage() {
  const listings = await getAllJobListings();

  const data: JobListing[] = listings.map((listing) => ({
    listing_id: listing.listing_id,
    title: listing.title,
    type: listing.type,
    company_name: listing.companies.company_name,
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

      <Tabs defaultValue="published" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="published">
            Publiserte ({groupedListings.published.length})
          </TabsTrigger>
          <TabsTrigger value="unpublished">
            Upubliserte ({groupedListings.unpublished.deadlineNotPassed.length + groupedListings.unpublished.deadlinePassed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="published" className="mt-6">
          <ListingsTable
            data={groupedListings.published}
            columns={createColumns}
            empty_message='Ingen publiserte stillingsannonser funnet'
          />
        </TabsContent>

        <TabsContent value="unpublished" className="mt-6">
          <div className='space-y-8'>
            {/* Unpublished Listings - Deadline Not Passed */}
            {groupedListings.unpublished.deadlineNotPassed.length > 0 && (
              <div>
                <h3 className='text-lg font-semibold mb-4'>Aktive upubliserte stillingsannonser</h3>
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
                <h3 className='text-lg font-semibold mb-4'>Utløpte upubliserte stillingsannonser</h3>
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
                <div className='text-center py-8'>
                  <p className='text-muted-foreground'>Ingen upubliserte stillingsannonser funnet</p>
                </div>
              )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
