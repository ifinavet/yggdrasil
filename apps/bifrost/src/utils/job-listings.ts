export type JobListing = {
  listingId: string;
  title: string;
  companyName: string;
  type: string;
  deadline: Date;
  published: boolean;
};

export type GroupedJobListings = {
  published: {
    deadlinePassed: JobListing[];
    deadlineNotPassed: JobListing[];
  };
  unpublished: {
    deadlinePassed: JobListing[];
    deadlineNotPassed: JobListing[];
  };
};

export function groupJobListings(listings: JobListing[]): GroupedJobListings {
  const now = new Date();

  const published = listings.filter((listing) => listing.published);
  const unpublished = listings.filter((listing) => !listing.published);

  const publishedDeadlinePassed = published.filter((listing) => listing.deadline < now);
  const publishedDeadlineNotPassed = published.filter((listing) => listing.deadline >= now);

  const unpublishedDeadlinePassed = unpublished.filter((listing) => listing.deadline < now);
  const unpublishedDeadlineNotPassed = unpublished.filter((listing) => listing.deadline >= now);

  return {
    published: {
      deadlinePassed: publishedDeadlinePassed,
      deadlineNotPassed: publishedDeadlineNotPassed,
    },
    unpublished: {
      deadlinePassed: unpublishedDeadlinePassed,
      deadlineNotPassed: unpublishedDeadlineNotPassed,
    },
  };
}
