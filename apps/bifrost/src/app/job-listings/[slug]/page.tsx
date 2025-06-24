import EditJobListingForm from "./edit-job-listing-form";

export default async function EditJobListingPage({ params }: { params: Promise<{ slug: number }> }) {
  return <EditJobListingForm listing_id={(await params).slug} />;
}
