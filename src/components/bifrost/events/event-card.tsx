import type {EventQuickView} from "@/app/(bifrost)/bifrost/events/actions";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";

export default function EventCard({ event }: { event: EventQuickView }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{event.title}</CardTitle>
                <CardDescription>{event.teaser}</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <h4 className='text-base'>Ansvarlige:</h4>
                    <ul>
                        {event.organizers.map((organizer) => (
                            <li key={organizer.id} className='flex flex-col'>
                                <span className='text-sm font-semibold'>
                                    {organizer.firstname} {organizer.lastname}
                                </span>
                                <span className='text-sm'>{organizer.type}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
            <CardContent>
                <div className='flex flex-col gap-2'>
                    <h4 className='text-base'>
                        Bedrift: <span className='font-semibold'>{event.company.name}</span>
                    </h4>
                </div>
            </CardContent>
        </Card>
    );
}
