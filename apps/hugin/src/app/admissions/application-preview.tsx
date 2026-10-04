"use client";
import { useForm } from "@tanstack/react-form";
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
import {
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Send,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { useState } from "react";
import { textareaClass } from "@/components/form-controls";
import { FormRow } from "@/components/job-listing-order/form-row";

const days = [
	"12. okt.",
	"13. okt.",
	"14. okt.",
	"15. okt.",
	"16. okt.",
	"19. okt.",
	"20. okt.",
	"21. okt.",
	"22. okt.",
	"23. okt.",
];
const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
export default function ApplicationPreview() {
	const [week, setWeek] = useState(0);
	const [sent, setSent] = useState(false);
	const [profileConfirmed, setProfileConfirmed] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const form = useForm({
		defaultValues: {
			about: "",
			motivation: "",
			group: "",
			program: "Programmering og systemarkitektur",
			year: "1",
			availability: [] as string[],
			consent: false,
		},
		onSubmit: () => {
			if (!profileConfirmed || editingProfile) return;
			setSent(true);
		},
	});
	if (sent)
		return (
			<div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-2 py-20 text-center">
				<Check className="size-10" />
				<h1 className="font-semibold text-3xl">Takk for søknaden!</h1>
				<p className="max-w-prose text-muted-foreground">
					Vi gleder oss til å bli kjent med deg. Du får en e-post når intervjutiden din er klar.
				</p>
				<p className="text-muted-foreground text-sm">
					Forhåndsvisning: ingen søknad eller e-post er sendt.
				</p>
				<Button variant="outline" onClick={() => setSent(false)}>
					Se søknaden
				</Button>
			</div>
		);
	return (
		<div className="mx-auto max-w-2xl py-10 text-left">
			<p className="mb-6 text-muted-foreground text-xs">Lokalt førsteutkast med testdata</p>
			<h1 className="font-semibold text-3xl tracking-tight">
				Bli med i Navet <span aria-hidden="true">👋</span>
			</h1>
			<p className="mt-3 max-w-prose text-base leading-relaxed">
				Så hyggelig at du vil bli med! Vi har lyst til å bli kjent med deg og høre hva du har lyst
				til å gjøre i Navet. Skriv med dine egne ord, det trenger ikke være en formell søknad.
			</p>
			<div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
				<span className="inline-flex items-center gap-2">
					<CalendarDays size={16} />
					Søk innen 11. oktober
				</span>
				<span className="inline-flex items-center gap-2">
					<UserRound size={16} />
					Anna Berg
				</span>
			</div>
			<form
				className="mt-10 flex flex-col gap-8"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<section className="rounded-xl bg-muted p-5" aria-label="Studieopplysninger">
					<p className="mb-3 text-sm">Vi har registrert dette på deg:</p>
					<form.Subscribe selector={(state) => [state.values.program, state.values.year]}>
						{([program, year]) => (
							<p className="font-medium">
								{program}
								<span className="mt-1 block text-sm">{year}. år</span>
							</p>
						)}
					</form.Subscribe>
					{!editingProfile && (
						<div className="mt-4 flex flex-wrap items-center gap-3">
							{profileConfirmed ? (
								<span className="inline-flex items-center gap-2 text-sm" role="status">
									<Check size={16} />
									Bekreftet
								</span>
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
					)}
					{editingProfile && (
						<div className="mt-5 flex flex-col gap-4">
							<div className="grid gap-5 sm:grid-cols-2">
								{(
									[
										[
											"program",
											"Studieprogram",
											[
												"Programmering og systemarkitektur",
												"Design, bruk, interaksjon",
												"Digital økonomi og ledelse",
												"Robotikk og intelligente systemer",
												"Språkteknologi",
											],
										],
										["year", "Studieår", ["1", "2", "3", "4", "5"]],
									] as const
								).map(([name, label, options]) => (
									<form.Field key={name} name={name}>
										{(field) => (
											<FormRow htmlFor={`profile-${name}`} label={label}>
												<Select
													required
													value={field.state.value}
													onValueChange={field.handleChange}
												>
													<SelectTrigger id={`profile-${name}`} className="w-full">
														<SelectValue placeholder="Velg" />
													</SelectTrigger>
													<SelectContent>
														{options.map((o) => (
															<SelectItem key={o} value={o}>
																{o}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormRow>
										)}
									</form.Field>
								))}
							</div>
							<form.Subscribe selector={(state) => [state.values.program, state.values.year]}>
								{([program, year]) => (
									<Button
										type="button"
										className="self-start"
										disabled={!program || !year}
										onClick={() => {
											setProfileConfirmed(true);
											setEditingProfile(false);
										}}
									>
										Lagre og bekreft
									</Button>
								)}
							</form.Subscribe>
						</div>
					)}
				</section>
				{(
					[
						[
							"about",
							"Fortell litt om deg selv",
							"Hvem er du utenom studiene? Fortell gjerne hvor du kommer fra, hvor gammel du er eller hva du liker å gjøre på fritiden. Kanskje har du studert noe annet eller vært med i en forening før? Velg det du har lyst til å dele 😊",
						],
						[
							"motivation",
							"Hvorfor vil du bli med i Navet?",
							"Hva frister med Navet? Vi vil gjerne høre hva du har lyst til å bidra med, lære eller bli en del av.",
						],
					] as const
				).map(([name, label, hint]) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<FormRow htmlFor={name} label={label} hint={<span id={`${name}-hint`}>{hint}</span>}>
								<Textarea
									className={textareaClass()}
									id={name}
									aria-describedby={`${name}-hint`}
									required
									minLength={10}
									maxLength={3000}
									rows={4}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</FormRow>
						)}
					</form.Field>
				))}
				<form.Field name="group">
					{(field) => (
						<FormRow
							htmlFor="admission-group"
							label="Hvilken arbeidsgruppe vil du være med i?"
							hint={
								<span id="group-hint">
									<a
										href="https://ifinavet.no/organization"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary underline underline-offset-4"
									>
										Les om arbeidsgruppene
										<span className="sr-only"> (åpnes i ny fane)</span>
									</a>{" "}
									Usikker? Det går helt fint, vi kan finne ut av det sammen på intervjuet.
								</span>
							}
						>
							<Select required value={field.state.value} onValueChange={field.handleChange}>
								<SelectTrigger
									id="admission-group"
									aria-describedby="group-hint"
									className="w-full"
								>
									<SelectValue placeholder="Velg arbeidsgruppe" />
								</SelectTrigger>
								<SelectContent>
									{["Bedrift", "Web", "Promo", "Intern", "Økonomi", "Usikker ennå"].map((g) => (
										<SelectItem key={g} value={g}>
											{g}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormRow>
					)}
				</form.Field>
				<section>
					<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
						<h2 className="font-semibold text-lg">Når kan du komme på intervju?</h2>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								size="icon"
								variant="outline"
								disabled={!week}
								aria-label="Forrige uke"
								onClick={() => setWeek(0)}
							>
								<ChevronLeft />
							</Button>
							<span className="text-sm">{week ? "19.–23. oktober" : "12.–16. oktober"}</span>
							<Button
								type="button"
								size="icon"
								variant="outline"
								disabled={Boolean(week)}
								aria-label="Neste uke"
								onClick={() => setWeek(1)}
							>
								<ChevronRight />
							</Button>
						</div>
					</div>
					<p className="mb-4 max-w-prose text-muted-foreground text-sm">
						Marker alle tidsrom som passer. Intervjuet varer i 15 minutter.
					</p>
					<form.Field name="availability">
						{(field) => (
							<>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[480px] border-separate border-spacing-1 text-sm">
										<thead>
											<tr>
												<th className="w-14" aria-label="Klokkeslett" />
												{days.slice(week * 5, week * 5 + 5).map((d) => (
													<th key={d} className="pb-2 font-medium">
														{d}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{hours.map((time) => (
												<tr key={time}>
													<th className="pr-2 font-normal text-muted-foreground">{time}</th>
													{days.slice(week * 5, week * 5 + 5).map((d) => {
														const id = `${d} ${time}`;
														const checked = field.state.value.includes(id);
														return (
															<td key={d}>
																<button
																	type="button"
																	aria-label={`${d} klokken ${time}`}
																	aria-pressed={checked}
																	className={`flex h-10 w-full items-center justify-center rounded-md border transition-colors ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-muted hover:bg-accent"}`}
																	onClick={() =>
																		field.handleChange(
																			checked
																				? field.state.value.filter((x) => x !== id)
																				: [...field.state.value, id],
																		)
																	}
																>
																	{checked ? <Check size={16} /> : null}
																</button>
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<p className="mt-3 text-muted-foreground text-sm">
									{field.state.value.length} tidsrom valgt
								</p>
							</>
						)}
					</form.Field>
				</section>
				<div className="rounded-xl bg-muted p-5">
					<h2 className="mb-3 flex items-center gap-2 font-semibold">
						<ShieldCheck size={18} />
						Opplysningene dine
					</h2>
					<p className="max-w-prose text-sm leading-relaxed">
						Vi lagrer navn, e-post, studieprogram, studieår, søknadssvar og tilgjengelighet. Bare de
						som gjennomfører opptaket har tilgang. Opptaksdata slettes når opptaket avsluttes,
						senest 30. oktober 2026.
					</p>
					<form.Field name="consent">
						{(field) => (
							<label
								htmlFor="admission-consent"
								className="mt-5 flex items-center gap-3 font-medium text-sm"
							>
								<Checkbox
									id="admission-consent"
									required
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked === true)}
									className="size-4"
								/>
								Jeg godkjenner
							</label>
						)}
					</form.Field>
				</div>
				<form.Subscribe selector={(s) => [s.values.availability.length, s.values.consent]}>
					{([count, consent]) => (
						<Button
							type="submit"
							size="lg"
							disabled={!count || !consent || !profileConfirmed || editingProfile}
							className="self-start"
						>
							<Send />
							Send søknad
						</Button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
}
