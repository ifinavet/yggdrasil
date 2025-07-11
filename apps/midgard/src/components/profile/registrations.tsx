import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { getRegistrationsById } from "@/lib/query/profile";
import { humanReadableDateTime } from "@/uitls/dateFormatting";

export default async function Registrations({
	userId,
	className,
}: {
	userId: string;
	className?: string;
}) {
	const registrations = await getRegistrationsById(userId);

	const previousEvents = registrations.filter(
		(registration) => registration.events.event_start < new Date().toISOString(),
	);
	const upcomingEvents = registrations.filter(
		(registration) => registration.events.event_start >= new Date().toISOString(),
	);

	return (
		<Tabs defaultValue='upcoming' className={cn(className, "max-w-full overflow-scroll")}>
			<TabsList className='w-full'>
				<TabsTrigger value='upcoming'>Kommende</TabsTrigger>
				<TabsTrigger value='previous'>Tidligere</TabsTrigger>
			</TabsList>
			<TabsContent value='upcoming'>
				<div className='grid gap-4'>
					{upcomingEvents.map((registration) => (
						<Card key={registration.registration_id}>
							<CardHeader>
								<CardTitle>{registration.events.title}</CardTitle>
								<CardDescription>
									Du registrerte deg til arrangementet{" "}
									{humanReadableDateTime(new Date(registration.registration_time ?? ""))}.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className='text-balance font-semibold tracking-normal'>
									Du er{" "}
									{registration.status === "registerd"
										? "påmeldt dette arrangementet"
										: "på venteliste til dette arrangementet"}
									.
								</p>
								<p className='text-balance'>
									Arragnementet starter{" "}
									{humanReadableDateTime(new Date(registration.events.event_start))}
								</p>
							</CardContent>
							<CardFooter>
								<Button asChild>
									<Link href={`/events/${registration.event_id}`}>Gå til arrangementet</Link>
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			</TabsContent>
			<TabsContent value='previous'>
				<div className='grid grid-cols-1 gap-4'>
					{previousEvents.map((registration) => (
						<Card key={registration.registration_id}>
							<CardHeader>
								<CardTitle>{registration.events.title}</CardTitle>
								<CardDescription>
									Du registrerte deg til arrangementet{" "}
									{humanReadableDateTime(new Date(registration.registration_time ?? ""))}.
								</CardDescription>
							</CardHeader>
							<CardContent className='grid gap-2'>
								<p className='text-balance font-semibold tracking-normal'>
									Du var{" "}
									{registration.status === "registerd"
										? "påmeldt dette arrangementet"
										: "på venteliste til dette arrangementet"}
									.
								</p>
								<p className='text-balance'>
									Arragnementet startet{" "}
									{humanReadableDateTime(new Date(registration.events.event_start))}
								</p>
								<p className='text-balance'>
									{registration.status === "waitlist"
										? "Du var på venteliste"
										: registration.attendance_status === "registered"
											? "Du møtte tidsnok til arrangementet"
											: registration.attendance_status === "late"
												? "Du møtte sent til arrangementet"
												: "Du møtte ikke til arrangementet"}
									.
								</p>
							</CardContent>
							<CardFooter>
								<Button asChild>
									<Link href={`/events/${registration.event_id}`}>Gå til arrangementet</Link>
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			</TabsContent>
		</Tabs>
	);
}
