import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { getRegistrationsById } from "@/lib/query/profile";

export default async function Registrations({ userId }: { userId: string }) {
  const registrations = await getRegistrationsById(userId);

  const previousEvents = registrations.filter(
    (registration) => registration.events.event_start < new Date().toISOString(),
  );
  const upcomingEvents = registrations.filter(
    (registration) => registration.events.event_start >= new Date().toISOString(),
  );

  return (
    <Tabs defaultValue='upcoming'>
      <TabsList>
        <TabsTrigger value='upcoming'>Kommende arrangementer</TabsTrigger>
        <TabsTrigger value='previous'>Tidligere arrangementer</TabsTrigger>
      </TabsList>
      <TabsContent value='upcoming'>
        {upcomingEvents.map((registration) => (
          <div key={registration.registration_id}>
            <h3>{registration.events.title}</h3>
            <p>{registration.status}</p>
          </div>
        ))}
      </TabsContent>
      <TabsContent value='previous'>
        {previousEvents.map((registration) => (
          <div key={registration.registration_id}>
            <h3>{registration.events.title}</h3>
            <p>{registration.status}</p>
            <p>{registration.attendance_status}</p>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
