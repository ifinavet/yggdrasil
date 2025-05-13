"use client";

import {type EventQuickView, getEvents, getPossibleSemesters,} from "@/app/dashboard/events/actions";
import EventCard from "@/components/dashboard/events/event-card";
import {Button} from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {PlusIcon} from "lucide-react";
import Link from "next/link";
import {useEffect, useState} from "react";

export default function EventsGrid() {
    const today = new Date();
    const year = today.getFullYear().toString().substring(2);
    const half = today.getMonth() < 6 ? "V" : "H";

    const [semesters, setSemesters] = useState<string[]>([]);
    const [selectedSemester, setSelectedSemester] = useState(`${half}${year}`);
    const [isLoading, setIsLoading] = useState(true);

    const [events, setEvents] = useState<EventQuickView[]>([]);

    useEffect(() => {
        async function fetchSemesters() {
            setIsLoading(true);
            const semesters = await getPossibleSemesters();
            setSemesters(semesters);
        }

        fetchSemesters();
    }, []);

    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            const events = await getEvents(selectedSemester);
            setEvents(events);
            setIsLoading(false);
        }

        fetchEvents();
    }, [selectedSemester]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <div className='flex w-full justify-between'>
                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                    <SelectTrigger className='w-[180px]'>
                        <SelectValue placeholder='Semester' />
                    </SelectTrigger>
                    <SelectContent>
                        {semesters?.map((semester) => {
                            return (
                                <SelectItem key={semester} value={semester}>
                                    {semester}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                <Button className='bg-gray-800 text-white hover:bg-navet-500'>
                    <Link href='/dashboard/events/create-event' className='flex gap-2 items-center'>
                        <PlusIcon size={18} />
                        <span>Lag et arrangement</span>
                    </Link>
                </Button>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 mt-4'>
                {events.map((event) => {
                    return (
                        <span key={event.id}>
                            <EventCard event={event} />
                        </span>
                    );
                })}
            </div>
        </>
    );
}
