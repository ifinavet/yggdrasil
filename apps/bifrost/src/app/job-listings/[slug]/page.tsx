import EditJobListingForm from "./edit-job-listing-form";

export default function EditJobListingPage({ params }: { params: { slug: number } }) {
  return <EditJobListingForm listing_id={params.slug} />;
}
