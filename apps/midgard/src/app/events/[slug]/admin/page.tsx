import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import AttendeeScanner from "@/components/events/admin/scanner";

export default async function AdminPage({ params }: { params: Promise<{ slug: number }> }) {
  const event_id = await params.then(({ slug }) => slug);

  return (
    <ResponsiveCenterContainer>
      <h1>Hei!</h1>
      <p>{event_id}</p>
      <AttendeeScanner />
    </ResponsiveCenterContainer>
  );
}
