"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import { Callout } from "@workspace/ui/components/products/callout";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Interviewer } from "./model";

export function AvailabilityDialog({
	open,
	onOpenChange,
	interviewers,
	onSave,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	interviewers: Interviewer[];
	onSave: (person: Interviewer) => void;
}>) {
	const connect = (person: Interviewer) => {
		onSave({ ...person, calendarStatus: "connected" });
		toast.info("Forhåndsvisning: bruker testkalendere. Ingen Google-konto er koblet til.");
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle>Kalendere</DialogTitle>
				</DialogHeader>
				<Callout>
					Legg til private kalendere og timeplanen din i Google Kalender på ifinavet.no-kontoen.
					Velg dem her, så tar vi hensyn til avtalene dine når vi finner intervjutider.
				</Callout>
				<a
					href="https://calendar.google.com/"
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
				>
					Åpne Google Kalender
					<ExternalLink size={14} />
				</a>
				<div className="flex flex-col gap-6">
					{interviewers.map((person) => (
						<section key={person.id} className="flex flex-col gap-3">
							<div className="flex items-center gap-3">
								<Avatar>
									<AvatarImage src={person.image} alt="" />
									<AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
								</Avatar>
								<h3 className="font-medium">{person.name}</h3>
							</div>
							{person.calendarStatus === "connected" ? (
								<div className="flex flex-col gap-3 pl-11">
									{person.calendars.map((calendar) => (
										<Label key={calendar.id} className="flex items-center gap-3">
											<Checkbox
												checked={calendar.selected}
												onCheckedChange={(checked) =>
													onSave({
														...person,
														calendars: person.calendars.map((entry) =>
															entry.id === calendar.id
																? { ...entry, selected: checked === true }
																: entry,
														),
													})
												}
											/>
											{calendar.name}
											{!calendar.readable && (
												<span className="text-destructive">Mangler tilgang</span>
											)}
										</Label>
									))}
								</div>
							) : (
								<Button variant="outline" onClick={() => connect(person)}>
									{person.calendarStatus === "error"
										? "Prøv tilkobling igjen"
										: "Koble til Google-kalender"}
								</Button>
							)}
							{person.calendarStatus === "connected" && (
								<Button variant="ghost" className="self-start" onClick={() => connect(person)}>
									<RefreshCw />
									Oppdater kalendere
								</Button>
							)}
						</section>
					))}
				</div>
				{!interviewers.length && <p>Velg intervjuere i innstillingene først.</p>}
				<Button onClick={() => onOpenChange(false)}>Ferdig</Button>
			</DialogContent>
		</Dialog>
	);
}
