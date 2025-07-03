export default async function AdminPage({ params }: { params: Promise<{ slug: number }> }) {
  const event_id = await params.then(({ slug }) => slug);


  return (
    <div>
      <h1>Hei!</h1>
      <p>{event_id}</p>
    </div>
  );
}
