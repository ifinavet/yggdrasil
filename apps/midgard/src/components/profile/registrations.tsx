import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { getAuthToken } from "@/utils/authToken";
import { humanReadableDateTime } from "@/utils/dateFormatting";

export default async function Registrations({
	className,
}: Readonly<{ className?: string }>) {
	const token = await getAuthToken();
	const registrations = await fetchQuery(
		api.registration.getCurrentUser,
		{},
		{ token },
	);

	const previousEvents = registrations.filter(
		(registration) => registration.eventStart < Date.now(),
	);
	const upcomingEvents = registrations.filter(
		(registration) => registration.eventStart >= Date.now(),
	);

	return (
		<Tabs
			defaultValue="upcoming"
			className={cn(className, "max-w-full overflow-y-scroll")}
		>
			<TabsList className="w-full">
				<TabsTrigger value="upcoming">Kommende</TabsTrigger>
				<TabsTrigger value="previous">Tidligere</TabsTrigger>
			</TabsList>
			<TabsContent value="upcoming">
				<div className="grid gap-4">
					{upcomingEvents.map((registration) => (
						<Card key={registration._id}>
							<CardHeader>
								<CardTitle>{registration.eventTitle}</CardTitle>
								<CardDescription>
									Du registrerte deg til arrangementet{" "}
									{humanReadableDateTime(
										new Date(registration.registrationTime),
									)}
									.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-balance font-semibold tracking-normal">
									Du er{" "}
									{registration.status === "registered"
										? "påmeldt dette arrangementet"
										: "på venteliste til dette arrangementet"}
									.
								</p>
								<p className="text-balance">
									Arragnementet starter{" "}
									{humanReadableDateTime(new Date(registration.eventStart))}
								</p>
							</CardContent>
							<CardFooter>
								<Button asChild className="text-primary-foreground">
									<Link href={`/events/${registration.eventId}`}>
										Gå til arrangementet
									</Link>
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			</TabsContent>
			<TabsContent value="previous">
				<div className="grid grid-cols-1 gap-4">
					{previousEvents.map((registration) => (
						<Card key={registration._id}>
							<CardHeader>
								<CardTitle>{registration.eventTitle}</CardTitle>
								<CardDescription>
									Du registrerte deg til arrangementet{" "}
									{humanReadableDateTime(
										new Date(registration.registrationTime),
									)}
									.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-2">
								<p className="text-balance font-semibold tracking-normal">
									Du var{" "}
									{registration.status === "registered"
										? "påmeldt dette arrangementet"
										: "på venteliste til dette arrangementet"}
									.
								</p>
								<p className="text-balance">
									Arragnementet startet{" "}
									{humanReadableDateTime(new Date(registration.eventStart))}
								</p>
								<p className="text-balance">
									{registration.status === "waitlist"
										? "Du var på venteliste"
										: registration.attendanceStatus === "confirmed"
											? "Du møtte tidsnok til arrangementet"
											: registration.attendanceStatus === "late"
												? "Du møtte sent til arrangementet"
												: "Du møtte ikke til arrangementet"}
									.
								</p>
							</CardContent>
							<CardFooter>
								<Button asChild className="text-primary-foreground">
									<Link href={`/events/${registration.eventId}`}>
										Gå til arrangementet
									</Link>
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			</TabsContent>
		</Tabs>
	);
}
