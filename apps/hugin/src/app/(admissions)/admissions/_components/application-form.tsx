"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	ADMISSION_CONSENT,
	ADMISSION_UNSURE_GROUP,
	type AvailabilityWindow,
} from "@workspace/shared/admissions";
import type { DEGREE_TYPES } from "@workspace/shared/constants";
import { midgardUrl } from "@workspace/shared/constants/hugin-url";
import {
	calendarDaysBetween,
	DATE_PATTERNS,
	formatOsloDate,
	minutesToClock as formatTime,
	localDateAndMinute,
} from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { StudentProfileFields } from "@workspace/ui/components/student-profile-fields";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { textareaClass } from "@/components/form-controls";
import { FormRow } from "@/components/job-listing-order/form-row";
import type { InitialApplication, Period } from "./application";
import { ProfileConfirmation } from "./profile-confirmation";

const applicationSchema = z.object({
	about: z.string().trim().min(10, "Skriv minst 10 tegn."),
	motivation: z.string().trim().min(10, "Skriv minst 10 tegn."),
	group: z.string().min(1, "Velg en arbeidsgruppe."),
});
type ApplicationValues = z.infer<typeof applicationSchema>;

export function ApplicationForm({
	period,
	initialApplication,
	profile,
}: Readonly<{
	period: Period;
	initialApplication: InitialApplication;
	profile: NonNullable<FunctionReturnType<typeof api.users.students.queries.getCurrent>>;
}>) {
	const groups = useQuery(api.admissions.queries.availableGroups, {});
	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
	const saveApplication = useMutation(api.admissions.mutations.saveApplication);
	const [revision, setRevision] = useState(initialApplication?.revision ?? 0);
	const [availability, setAvailability] = useState<AvailabilityWindow[]>(
		initialApplication?.availability ?? [],
	);
	const [studyProgram, setStudyProgram] = useState(profile.studyProgram);
	const [degree, setDegree] = useState<(typeof DEGREE_TYPES)[number]>(
		profile.degree as (typeof DEGREE_TYPES)[number],
	);
	const [year, setYear] = useState(profile.year);
	const [profileConfirmed, setProfileConfirmed] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const [consent, setConsent] = useState(false);
	const { pending: busy, error, run } = useAsyncAction();
	const [message, setMessage] = useState("");
	const [selectedDays, setSelectedDays] = useState<string[]>([]);
	const [noSuitableTimes, setNoSuitableTimes] = useState(
		initialApplication?.availability.length === 0,
	);
	const [start, setStart] = useState(period.dayStart);
	const [end, setEnd] = useState(Math.min(period.dayStart + 60, period.dayEnd));
	const form = useForm({
		defaultValues: {
			about: initialApplication?.about ?? "",
			motivation: initialApplication?.motivation ?? "",
			group: initialApplication?.group ?? "",
		},
		validators: { onSubmit: applicationSchema },
		onSubmit: ({ value }) => persistApplication(value, true),
	});

	const dates = interviewDays(period.interviewStartAt, period.interviewEndAt, period.timezone);
	const validTime =
		start >= period.dayStart &&
		end <= period.dayEnd &&
		start < end &&
		(start - period.dayStart) % 15 === 0 &&
		(end - period.dayStart) % 15 === 0;
	const selectedCount = availability.length;
	function perform(action: () => Promise<void>, fallback: string) {
		setMessage("");
		return run(action, undefined, fallback);
	}

	async function persistApplication(value: ApplicationValues, send = false) {
		if (
			!profileConfirmed ||
			editingProfile ||
			(!availability.length && !noSuitableTimes) ||
			(send && !consent)
		)
			return;
		await perform(
			async () => {
				const saved = await saveApplication({
					periodId: period._id,
					expectedRevision: revision,
					submit: send,
					consent,
					...value,
					group: value.group as Id<"internalGroups"> | typeof ADMISSION_UNSURE_GROUP,
					availability,
				});
				setRevision(saved.revision);
				setMessage(send ? "Søknaden din er sendt." : "Utkastet er lagret.");
			},
			send ? "Søknaden kunne ikke sendes. Prøv igjen." : "Utkastet kunne ikke lagres. Prøv igjen.",
		);
	}

	async function saveStudentProfile() {
		await perform(async () => {
			await updateProfile({ studyProgram, degree, year });
			setProfileConfirmed(true);
			setEditingProfile(false);
			setMessage("Studentprofilen er oppdatert.");
		}, "Studentprofilen kunne ikke oppdateres. Prøv igjen.");
	}

	function addAvailability() {
		if (!validTime || !selectedDays.length) return;
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
				<ProfileConfirmation
					program={profile.studyProgram}
					year={profile.year}
					confirmed={profileConfirmed}
					editing={editingProfile}
					onConfirm={() => setProfileConfirmed(true)}
					onEdit={() => {
						setEditingProfile(true);
						setProfileConfirmed(false);
					}}
				>
					<StudentProfileFields
						studyProgram={{ state: { value: studyProgram }, handleChange: setStudyProgram }}
						degree={{ state: { value: degree }, handleChange: setDegree }}
						year={{ state: { value: year }, handleChange: setYear }}
					/>
					<Button
						type="button"
						disabled={busy || !studyProgram}
						className="self-start"
						onClick={() => void saveStudentProfile()}
					>
						Lagre og bekreft
					</Button>
				</ProfileConfirmation>
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
									disabled={groups === undefined}
								>
									<SelectValue placeholder="Velg arbeidsgruppe" />
								</SelectTrigger>
								<SelectContent>
									{groups?.map((item) => (
										<SelectItem key={item._id} value={item._id}>
											{item.name}
										</SelectItem>
									))}
									<SelectItem value={ADMISSION_UNSURE_GROUP}>Usikker ennå</SelectItem>
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
							<Input
								id="availability-start"
								type="time"
								disabled={noSuitableTimes}
								step={900}
								min={formatTime(period.dayStart)}
								max={formatTime(period.dayEnd - 15)}
								value={Number.isFinite(start) ? formatTime(start) : ""}
								onChange={(event) => {
									const next = event.currentTarget.valueAsNumber / 60_000;
									setStart(next);
									if (end <= next) setEnd(Math.min(next + 60, period.dayEnd));
								}}
								className="w-32"
							/>
						</FormRow>
						<FormRow htmlFor="availability-end" label="Til">
							<Input
								id="availability-end"
								type="time"
								disabled={noSuitableTimes}
								step={900}
								min={formatTime(start + 15)}
								max={formatTime(period.dayEnd)}
								value={Number.isFinite(end) ? formatTime(end) : ""}
								onChange={(event) => setEnd(event.currentTarget.valueAsNumber / 60_000)}
								className="w-32"
							/>
						</FormRow>
						<Button
							type="button"
							variant="outline"
							disabled={!selectedDays.length || !validTime}
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
						{ADMISSION_CONSENT.title}
					</h2>
					<p className="max-w-prose text-sm leading-relaxed">
						{ADMISSION_CONSENT.description(
							formatOsloDate(period.retentionAt, DATE_PATTERNS.longDate),
						)}
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
						<span>{ADMISSION_CONSENT.label}</span>
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
									onClick={() => void persistApplication({ about, motivation, group })}
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
				{(error || message) && <output className="text-sm">{error || message}</output>}
			</form>
		</div>
	);
}

function interviewDays(startAt: number, endAt: number, timeZone: string) {
	const first = localDateAndMinute(startAt, timeZone).day;
	const last = localDateAndMinute(endAt, timeZone).day;
	return calendarDaysBetween(first, last, timeZone).map((day) => ({ day, label: formatDay(day) }));
}

function formatDay(day: string) {
	return formatOsloDate(Date.parse(`${day}T12:00:00Z`), DATE_PATTERNS.shortDate);
}
