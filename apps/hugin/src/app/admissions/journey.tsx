"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { ADMISSION_GROUPS, type AvailabilityWindow } from "@workspace/shared/admissions";
import {
	DEGREE_TYPES,
	DEGREE_YEARS,
	degreesFor,
	fittingDegree,
	fittingYear,
	STUDY_PROGRAMS,
} from "@workspace/shared/constants";
import { midgardUrl } from "@workspace/shared/constants/hugin-url";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Check, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { textareaClass } from "@/components/form-controls";
import { FormRow } from "@/components/job-listing-order/form-row";

type Period = {
	_id: Id<"admissionPeriods">;
	title: string;
	applicationEndAt: number;
	interviewStartAt: number;
	interviewEndAt: number;
	retentionAt: number;
	timezone: string;
};

type InitialApplication = {
	_id: Id<"admissionApplications">;
	periodId: Id<"admissionPeriods">;
	status: "draft" | "submitted" | "withdrawn";
	revision: number;
	about?: string;
	motivation?: string;
	group?: string;
	availability: AvailabilityWindow[];
	decision: "pending" | "shortlist" | "accepted" | "rejected";
	decisionSentAt?: number;
	offerStatus: "none" | "pending" | "accepted" | "declined" | "expired";
	offerDeadline?: number;
	interviewStatus: "scheduled" | "cancelled" | null;
	interview: { startAt: number; endAt: number; room: string } | null;
	period: {
		title: string;
		timezone: string;
		applicationEndAt?: number;
		interviewStartAt?: number;
		interviewEndAt?: number;
		retentionAt?: number;
	};
} | null;

const applicationSchema = z.object({
	about: z.string().trim().min(10, "Skriv minst 10 tegn."),
	motivation: z.string().trim().min(10, "Skriv minst 10 tegn."),
	group: z.enum(ADMISSION_GROUPS),
});
type ApplicationValues = { about: string; motivation: string; group: string };
const timeOptions = Array.from({ length: 33 }, (_, index) => {
	const minutes = 9 * 60 + index * 15;
	return {
		minutes,
		label: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
	};
});

export default function AdmissionsJourney({
	period,
	initialApplication,
}: Readonly<{
	period: Period;
	initialApplication: InitialApplication;
}>) {
	const application = useQuery(api.admissions.queries.myApplication, { periodId: period._id }) as
		| InitialApplication
		| undefined;
	const profile = useQuery(api.users.students.queries.getCurrentForAdmissions, {});
	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
	const saveDraft = useMutation(api.admissions.mutations.saveDraft);
	const submit = useMutation(api.admissions.mutations.submit);
	const reopen = useMutation(api.admissions.mutations.reopenApplication);
	const cancelInterview = useMutation(api.admissions.mutations.cancelInterview);
	const respondToOffer = useMutation(api.admissions.mutations.respondToOffer);
	const [availability, setAvailability] = useState<AvailabilityWindow[]>(
		initialApplication?.availability ?? [],
	);
	const [studyProgram, setStudyProgram] = useState("");
	const [degree, setDegree] = useState<(typeof DEGREE_TYPES)[number]>(DEGREE_TYPES[0]);
	const [year, setYear] = useState(1);
	const [profileConfirmed, setProfileConfirmed] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const [consent, setConsent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [editingSubmitted, setEditingSubmitted] = useState(false);
	const [cancelledInterview, setCancelledInterview] = useState(false);
	const [selectedDays, setSelectedDays] = useState<string[]>([]);
	const [noSuitableTimes, setNoSuitableTimes] = useState(
		initialApplication?.availability.length === 0,
	);
	const [start, setStart] = useState(9 * 60);
	const [end, setEnd] = useState(10 * 60);
	const form = useForm({
		defaultValues: {
			about: initialApplication?.about ?? "",
			motivation: initialApplication?.motivation ?? "",
			group: initialApplication?.group ?? "",
		},
		validators: { onSubmit: applicationSchema },
		onSubmit: ({ value }) => sendApplication(value),
	});

	useEffect(() => {
		if (profile && !studyProgram) {
			setStudyProgram(profile.studyProgram);
			setDegree(profile.degree as (typeof DEGREE_TYPES)[number]);
			setYear(profile.year);
		}
	}, [profile, studyProgram]);

	const dates = interviewDays(period.interviewStartAt, period.interviewEndAt, period.timezone);
	const selectedCount = availability.length;
	async function persistDraft(value: ApplicationValues = form.state.values) {
		if (!profileConfirmed || editingProfile || (!availability.length && !noSuitableTimes)) return;
		setBusy(true);
		setMessage("");
		try {
			await saveDraft({ periodId: period._id, ...value, availability });
			setMessage("Utkastet er lagret.");
		} catch {
			setMessage("Utkastet kunne ikke lagres. Prøv igjen.");
		} finally {
			setBusy(false);
		}
	}

	async function sendApplication(value: ApplicationValues) {
		if (
			!consent ||
			!profileConfirmed ||
			editingProfile ||
			(!availability.length && !noSuitableTimes)
		)
			return;
		setBusy(true);
		setMessage("");
		try {
			const saved = await saveDraft({ periodId: period._id, ...value, availability });
			await submit({ periodId: period._id, expectedRevision: saved.revision, consent });
			setMessage("Søknaden din er sendt.");
			setEditingSubmitted(false);
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Søknaden kunne ikke sendes. Prøv igjen.",
			);
		} finally {
			setBusy(false);
		}
	}

	async function saveStudentProfile() {
		setBusy(true);
		try {
			await updateProfile({ studyProgram, degree, year });
			setProfileConfirmed(true);
			setEditingProfile(false);
			setMessage("Studentprofilen er oppdatert.");
		} catch {
			setMessage("Studentprofilen kunne ikke oppdateres. Prøv igjen.");
		} finally {
			setBusy(false);
		}
	}

	if (profile === undefined || application === undefined) return <JourneyLoading />;
	if (!profile) {
		return (
			<Notice title="Studentprofilen din er ikke klar ennå">
				<p>Opprett studentprofilen din på Midgard før du søker.</p>
				<Button asChild variant="outline">
					<Link href={`${midgardUrl()}/profile`}>Åpne profilen</Link>
				</Button>
			</Notice>
		);
	}

	if (application?.status === "submitted" && !editingSubmitted)
		return (
			<SubmittedApplicationView
				application={application}
				period={period}
				busy={busy}
				message={message}
				cancelledInterview={cancelledInterview}
				onReply={replyToOffer}
				onCancelInterview={cancelAssignedInterview}
				onReopen={reopenApplication}
			/>
		);

	async function reopenApplication() {
		if (!application) return;
		setBusy(true);
		try {
			await reopen({ periodId: period._id, expectedRevision: application.revision });
			setEditingSubmitted(true);
		} catch {
			setMessage("Søknaden kunne ikke åpnes for endring.");
		} finally {
			setBusy(false);
		}
	}

	async function cancelAssignedInterview() {
		if (!application) return;
		setBusy(true);
		try {
			await cancelInterview({
				applicationId: application._id,
				expectedRevision: application.revision,
				idempotencyKey: crypto.randomUUID(),
			});
			setCancelledInterview(true);
		} catch {
			setMessage("Intervjuet kunne ikke avlyses. Prøv igjen.");
		} finally {
			setBusy(false);
		}
	}

	async function replyToOffer(accept: boolean) {
		if (!application) return;
		setBusy(true);
		try {
			const result = await respondToOffer({
				periodId: period._id,
				accept,
				expectedRevision: application.revision,
			});
			if (result.offerStatus === "expired") {
				setMessage("Svarfristen for tilbudet har gått ut.");
				return;
			}
			setMessage(accept ? "Du har takket ja til plassen" : "Takk for at du ga beskjed");
		} catch (error) {
			setMessage(convexErrorMessage(error, "Svaret ditt kunne ikke lagres. Prøv igjen."));
		} finally {
			setBusy(false);
		}
	}

	function addAvailability() {
		if (start >= end || !selectedDays.length) return;
		const merged = [...availability, ...selectedDays.map((day) => ({ day, start, end }))]
			.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start)
			.reduce<AvailabilityWindow[]>((result, item) => {
				const previous = result.at(-1);
				if (previous && previous.day === item.day && previous.end >= item.start) {
					result[result.length - 1] = { ...previous, end: Math.max(previous.end, item.end) };
				} else result.push(item);
				return result;
			}, []);
		setAvailability(merged);
		setNoSuitableTimes(false);
	}

	return (
		<div className="mx-auto max-w-2xl py-10 text-left">
			<h1 className="font-semibold text-3xl tracking-tight">Bli med i Navet</h1>
			<p className="mt-3 max-w-prose text-base leading-relaxed">
				Så hyggelig at du vil bli med! Skriv med dine egne ord. Det trenger ikke være en formell
				søknad.
			</p>
			<div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
				<span className="inline-flex items-center gap-2">
					<CalendarDays size={16} />
					Søk innen {formatOsloDate(period.applicationEndAt, DATE_PATTERNS.shortDateWithYear)}
				</span>
				<span className="inline-flex items-center gap-2">
					<UserRound size={16} />
					{profile.firstName} {profile.lastName}
				</span>
			</div>
			<form
				className="mt-10 flex flex-col gap-8"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<section className="rounded-xl bg-muted p-5" aria-label="Studieopplysninger">
					<p className="mb-3 text-sm">Vi har registrert dette på deg:</p>
					<p className="font-medium">
						{profile.studyProgram}
						<span className="mt-1 block text-sm">{profile.year}. år</span>
					</p>
					{!editingProfile ? (
						<div className="mt-4 flex flex-wrap items-center gap-3">
							{profileConfirmed ? (
								<output className="inline-flex items-center gap-2 text-sm">
									<Check size={16} />
									Bekreftet
								</output>
							) : (
								<>
									<span className="text-sm">Stemmer dette?</span>
									<Button type="button" size="sm" onClick={() => setProfileConfirmed(true)}>
										Ja
									</Button>
								</>
							)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => {
									setEditingProfile(true);
									setProfileConfirmed(false);
								}}
							>
								{profileConfirmed ? "Endre" : "Nei, endre"}
							</Button>
						</div>
					) : (
						<div className="mt-5 flex flex-col gap-4">
							<div className="grid gap-5 sm:grid-cols-3">
								<FormRow htmlFor="profile-program" label="Studieprogram">
									<Select
										value={studyProgram}
										onValueChange={(value) => {
											setStudyProgram(value);
											const nextDegree = fittingDegree(value, degree);
											setDegree(nextDegree);
											setYear(fittingYear(nextDegree, year));
										}}
									>
										<SelectTrigger id="profile-program" className="w-full">
											<SelectValue placeholder="Velg" />
										</SelectTrigger>
										<SelectContent>
											{STUDY_PROGRAMS.map((item) => (
												<SelectItem key={item} value={item}>
													{item}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormRow>
								<FormRow htmlFor="profile-degree" label="Grad">
									<Select
										value={degree}
										onValueChange={(value) => {
											const nextDegree = value as typeof degree;
											setDegree(nextDegree);
											setYear(fittingYear(nextDegree, year));
										}}
									>
										<SelectTrigger id="profile-degree" className="w-full">
											<SelectValue placeholder="Velg" />
										</SelectTrigger>
										<SelectContent>
											{degreesFor(studyProgram).map((item) => (
												<SelectItem key={item} value={item}>
													{item}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormRow>
								<FormRow htmlFor="profile-year" label="Studieår">
									<Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
										<SelectTrigger id="profile-year" className="w-full">
											<SelectValue placeholder="Velg" />
										</SelectTrigger>
										<SelectContent>
											{Array.from(
												{ length: DEGREE_YEARS[degree].last - DEGREE_YEARS[degree].first + 1 },
												(_, index) => DEGREE_YEARS[degree].first + index,
											).map((item) => (
												<SelectItem key={item} value={String(item)}>
													{item}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormRow>
							</div>
							<Button
								type="button"
								disabled={busy || !studyProgram}
								className="self-start"
								onClick={() => void saveStudentProfile()}
							>
								Lagre og bekreft
							</Button>
						</div>
					)}
				</section>
				{(
					[
						[
							"about",
							"Fortell litt om deg selv",
							"Hvem er du utenom studiene? Fortell gjerne hva du liker å gjøre på fritiden, eller om erfaringer du vil dele.",
						],
						[
							"motivation",
							"Hvorfor vil du bli med i Navet?",
							"Hva frister med Navet? Vi vil gjerne høre hva du har lyst til å bidra med eller lære.",
						],
					] as const
				).map(([name, label, hint]) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<FormRow htmlFor={name} label={label} hint={hint}>
								<Textarea
									className={textareaClass()}
									id={name}
									required
									minLength={10}
									maxLength={3000}
									rows={4}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							</FormRow>
						)}
					</form.Field>
				))}

				<FormRow
					htmlFor="admission-group"
					label="Hvilken arbeidsgruppe vil du være med i?"
					hint={
						<span id="group-hint">
							<a
								href={`${midgardUrl()}/organization`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline underline-offset-4"
							>
								Les om arbeidsgruppene <span className="sr-only">(åpnes i ny fane)</span>
							</a>{" "}
							Usikker? Det går helt fint, vi kan finne ut av det sammen på intervjuet.
						</span>
					}
				>
					<form.Field name="group">
						{(field) => (
							<Select value={field.state.value} onValueChange={field.handleChange}>
								<SelectTrigger
									id="admission-group"
									aria-describedby="group-hint"
									className="w-full"
								>
									<SelectValue placeholder="Velg arbeidsgruppe" />
								</SelectTrigger>
								<SelectContent>
									{ADMISSION_GROUPS.map((item) => (
										<SelectItem key={item} value={item}>
											{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</form.Field>
				</FormRow>
				<section>
					<h2 className="font-semibold text-lg">Når kan du komme på intervju?</h2>
					<p className="mt-2 mb-4 max-w-prose text-muted-foreground text-sm">
						Velg dagene du kan, og legg til tidsrommene som passer. Du kan legge til flere tidsrom
						for dagene du har valgt. Hvis ingen av tidene passer, kan du si fra her.
					</p>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{dates.map((item) => (
							<div
								key={item.day}
								className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm"
							>
								<Checkbox
									id={`interview-day-${item.day}`}
									aria-label={`Velg ${item.label}`}
									checked={selectedDays.includes(item.day)}
									onCheckedChange={(checked) =>
										setSelectedDays(
											checked
												? [...selectedDays, item.day]
												: selectedDays.filter((day) => day !== item.day),
										)
									}
								/>
								<span>{item.label}</span>
							</div>
						))}
					</div>
					<div className="mt-4 flex flex-wrap items-end gap-3">
						<FormRow htmlFor="availability-start" label="Fra">
							<Select
								value={String(start)}
								onValueChange={(value) => {
									const next = Number(value);
									setStart(next);
									if (end <= next) setEnd(Math.min(next + 60, 17 * 60));
								}}
							>
								<SelectTrigger id="availability-start" className="w-32">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{timeOptions.slice(0, -1).map((item) => (
										<SelectItem key={item.minutes} value={String(item.minutes)}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormRow>
						<FormRow htmlFor="availability-end" label="Til">
							<Select value={String(end)} onValueChange={(value) => setEnd(Number(value))}>
								<SelectTrigger id="availability-end" className="w-32">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{timeOptions
										.filter((item) => item.minutes > start)
										.map((item) => (
											<SelectItem key={item.minutes} value={String(item.minutes)}>
												{item.label}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</FormRow>
						<Button
							type="button"
							variant="outline"
							disabled={!selectedDays.length || start >= end}
							onClick={addAvailability}
						>
							Legg til tidsrom på valgte dager
						</Button>
					</div>
					<ul className="mt-4 flex flex-col gap-2 text-sm">
						{availability.map((item) => (
							<li
								key={`${item.day}-${item.start}-${item.end}`}
								className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
							>
								<span>
									{formatDay(item.day)} kl. {formatTime(item.start)} til {formatTime(item.end)}
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									aria-label={`Fjern ${formatDay(item.day)} klokken ${formatTime(item.start)}`}
									onClick={() => setAvailability(availability.filter((window) => window !== item))}
								>
									Fjern
								</Button>
							</li>
						))}
					</ul>
					<p className="mt-3 text-muted-foreground text-sm">
						{noSuitableTimes ? "Ingen av tidene passer" : `${selectedCount} tidsrom valgt`}
					</p>
					<label htmlFor="no-suitable-times" className="mt-3 flex items-start gap-3 text-sm">
						<Checkbox
							id="no-suitable-times"
							checked={noSuitableTimes}
							onCheckedChange={(checked) => {
								setNoSuitableTimes(checked === true);
								if (checked) {
									setAvailability([]);
									setSelectedDays([]);
								}
							}}
						/>
						<span>Ingen av tidene passer</span>
					</label>
				</section>
				<section className="rounded-xl bg-muted p-5">
					<h2 className="mb-3 flex items-center gap-2 font-semibold">
						<ShieldCheck size={18} />
						Slik bruker vi opplysningene dine
					</h2>
					<p className="max-w-prose text-sm leading-relaxed">
						Vi behandler navn, e-post, studieprogram, grad, studieår, søknadssvar, tilgjengeligheten
						din, eller at ingen av de foreslåtte tidene passer, eventuell intervjutid og
						opptaksbeslutning for å gjennomføre opptaket. Søknadsopplysningene slettes{" "}
						{formatOsloDate(period.retentionAt, DATE_PATTERNS.longDate)}. Studentprofilen din på
						Midgard blir ikke slettet som del av dette.
					</p>
					<label
						htmlFor="admission-consent"
						className="mt-5 flex items-start gap-3 font-medium text-sm"
					>
						<Checkbox
							id="admission-consent"
							checked={consent}
							onCheckedChange={(checked) => setConsent(checked === true)}
						/>
						<span>Jeg godtar at opplysningene over brukes til å gjennomføre opptaket.</span>
					</label>
				</section>
				<form.Subscribe
					selector={(state) => [state.values.about, state.values.motivation, state.values.group]}
				>
					{([aboutValue, motivationValue, groupValue]) => {
						const about = aboutValue ?? "";
						const motivation = motivationValue ?? "";
						const group = groupValue ?? "";
						const answersReady =
							about.trim().length >= 10 && motivation.trim().length >= 10 && Boolean(group);
						const canSave =
							answersReady &&
							(availability.length > 0 || noSuitableTimes) &&
							profileConfirmed &&
							!editingProfile;
						const canSubmit = canSave && consent;
						return (
							<div className="flex flex-wrap items-center gap-3">
								<Button
									type="button"
									variant="outline"
									disabled={busy || !canSave}
									onClick={() => void persistDraft({ about, motivation, group })}
								>
									{busy ? <LoaderCircle className="animate-spin" /> : null}Lagre utkast
								</Button>
								<Button type="submit" size="lg" disabled={busy || !canSubmit}>
									{busy ? <LoaderCircle className="animate-spin" /> : null}Send søknad
								</Button>
							</div>
						);
					}}
				</form.Subscribe>
				{message && <output className="text-sm">{message}</output>}
			</form>
		</div>
	);
}

function SubmittedApplicationView({
	application,
	period,
	busy,
	message,
	cancelledInterview,
	onReply,
	onCancelInterview,
	onReopen,
}: Readonly<{
	application: NonNullable<InitialApplication>;
	period: Period;
	busy: boolean;
	message: string;
	cancelledInterview: boolean;
	onReply: (accept: boolean) => Promise<void>;
	onCancelInterview: () => Promise<void>;
	onReopen: () => Promise<void>;
}>) {
	if (application.offerStatus === "expired")
		return (
			<Notice title="Svarfristen er passert">
				<p>Fristen for å svare på tilbudet har gått ut. Tilbudet er ikke lenger tilgjengelig.</p>
			</Notice>
		);
	if (application.offerStatus === "pending")
		return (
			<Notice title="Du har fått tilbud om plass">
				<p>Gi beskjed om du takker ja eller nei til tilbudet.</p>
				{application.offerDeadline && (
					<p>Svarfrist: {formatOsloDate(application.offerDeadline, DATE_PATTERNS.dateTime)}.</p>
				)}
				<div className="flex flex-wrap gap-3">
					<OfferConfirmation accept onConfirm={() => void onReply(true)} />
					<OfferConfirmation accept={false} onConfirm={() => void onReply(false)} />
				</div>
				{message && <output>{message}</output>}
			</Notice>
		);
	if (application.offerStatus === "accepted")
		return (
			<Notice title="Du har takket ja til plassen">
				<p>Navet har mottatt svaret ditt.</p>
			</Notice>
		);
	if (application.offerStatus === "declined")
		return (
			<Notice title="Takk for at du ga beskjed">
				<p>Vi har mottatt svaret ditt.</p>
			</Notice>
		);
	if (application.decisionSentAt && application.decision === "rejected")
		return (
			<Notice title="Takk for at du søkte">
				<p>Opptaket er ferdig for denne gangen.</p>
			</Notice>
		);
	if (application.interview)
		return (
			<Notice title="Intervjuet ditt">
				<p>{formatOsloDate(application.interview.startAt, DATE_PATTERNS.dateTime)}</p>
				<p>Møterom: {application.interview.room}</p>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="outline">Avlys intervjuet</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Avlyse intervjuet?</AlertDialogTitle>
							<AlertDialogDescription>
								Intervjutiden blir avlyst når du bekrefter.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Behold intervjuet</AlertDialogCancel>
							<AlertDialogAction onClick={() => void onCancelInterview()}>
								Ja, avlys intervjuet
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				{message && <output>{message}</output>}
			</Notice>
		);
	if (cancelledInterview || application.interviewStatus === "cancelled")
		return (
			<Notice title="Intervjuet er avlyst">
				<p>Vi har registrert at du har avlyst intervjuet.</p>
			</Notice>
		);
	return (
		<Notice title="Søknaden din er sendt">
			<p>Søknaden din er lagret.</p>
			{period.interviewStartAt > 0 &&
				Date.now() <= period.applicationEndAt &&
				!application.decisionSentAt && (
					<Button variant="outline" disabled={busy} onClick={() => void onReopen()}>
						Rediger søknaden
					</Button>
				)}
			{message && <output>{message}</output>}
		</Notice>
	);
}

function OfferConfirmation({
	accept,
	onConfirm,
}: Readonly<{ accept: boolean; onConfirm: () => void }>) {
	const verb = accept ? "ja" : "nei";
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant={accept ? "default" : "outline"}>{`Takk ${verb}`}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{`Takke ${verb} til plassen?`}</AlertDialogTitle>
					<AlertDialogDescription>
						{accept
							? "Når du bekrefter, registrerer vi at du takker ja."
							: "Når du bekrefter, registrerer vi at du takker nei."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Tilbake</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
					>{`Bekreft at jeg takker ${verb}`}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function Notice({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
	return (
		<section className="mx-auto max-w-xl py-16">
			<Check className="mb-4 size-7 text-primary" aria-hidden />
			<h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
			<div className="mt-4 flex flex-col items-start gap-3 text-base leading-relaxed">
				{children}
			</div>
		</section>
	);
}

function JourneyLoading() {
	return (
		<output className="mx-auto block max-w-2xl py-16" aria-label="Laster søknaden">
			<LoaderCircle className="size-6 animate-spin" />
		</output>
	);
}

function interviewDays(startAt: number, endAt: number, timeZone: string) {
	const getDay = (timestamp: number) =>
		new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(timestamp);
	const first = new Date(`${getDay(startAt)}T00:00:00Z`);
	const last = new Date(`${getDay(endAt)}T00:00:00Z`);
	const days: { day: string; label: string }[] = [];
	for (const cursor = first; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
		const day = cursor.toISOString().slice(0, 10);
		days.push({ day, label: formatDay(day) });
	}
	return days;
}

function formatDay(day: string) {
	return formatOsloDate(Date.parse(`${day}T12:00:00Z`), DATE_PATTERNS.shortDate);
}

function formatTime(minutes: number) {
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
