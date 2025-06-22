export type JobListing = {
  listing_id: number;
  title: string;
  company_name: string;
  type: string;
  deadline: Date;
  published: boolean;
};

export type GroupedJobListings = {
  published: JobListing[];
  unpublished: {
    deadlinePassed: JobListing[];
    deadlineNotPassed: JobListing[];
  };
};

export function groupJobListings(listings: JobListing[]): GroupedJobListings {
  const now = new Date();

  const published = listings.filter(listing => listing.published);
  const unpublished = listings.filter(listing => !listing.published);

  const deadlinePassed = unpublished.filter(listing => listing.deadline < now);
  const deadlineNotPassed = unpublished.filter(listing => listing.deadline >= now);

  return {
    published,
    unpublished: {
      deadlinePassed,
      deadlineNotPassed,
    },
  };
}
