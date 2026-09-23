"use client";

import type { FeedbackField } from "@workspace/shared/feedback";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

export function FeedbackQuestionsEditor({
	fields,
	onChange,
}: {
	fields: FeedbackField[];
	onChange: (fields: FeedbackField[]) => void;
}) {
	function updateQuestion(index: number, change: Partial<FeedbackField>) {
		onChange(
			fields.map((field, position) => (position === index ? { ...field, ...change } : field)),
		);
	}
	function moveQuestion(index: number, direction: number) {
		const reordered = [...fields];
		const target = index + direction;
		const currentQuestion = reordered[index];
		const targetQuestion = reordered[target];
		if (!currentQuestion || !targetQuestion) return;
		[reordered[index], reordered[target]] = [targetQuestion, currentQuestion];
		onChange(reordered);
	}
	return (
		<div className="space-y-4">
			{fields.map((question, index) => (
				<fieldset key={question.key} className="min-w-0 space-y-3 rounded-lg border p-4">
					<legend className="px-2 font-medium">Spørsmål {index + 1}</legend>
					<label htmlFor={`${question.key}-label`} className="block space-y-1 text-sm">
						<span>Spørsmålstekst</span>
						<Input
							id={`${question.key}-label`}
							value={question.label}
							onChange={(event) => updateQuestion(index, { label: event.target.value })}
						/>
					</label>
					<label className="block space-y-1 text-sm">
						<span>Svarformat</span>
						<select
							className="h-10 w-full rounded-md border bg-background px-3"
							value={question.type}
							onChange={(event) =>
								updateQuestion(index, {
									type: event.target.value as FeedbackField["type"],
									options:
										event.target.value === "options" ? (question.options ?? [""]) : undefined,
								})
							}
						>
							<option value="rating">Vurdering fra 1 til 5</option>
							<option value="text">Fritekst</option>
							<option value="yesNo">Ja eller nei</option>
							<option value="options">Flervalg</option>
						</select>
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={question.required}
							onChange={(event) => updateQuestion(index, { required: event.target.checked })}
						/>
						Obligatorisk svar
					</label>
					{question.type === "rating" && (
						<div className="grid gap-3 sm:grid-cols-2">
							<label htmlFor={`${question.key}-low`} className="space-y-1 text-sm">
								Tekst ved 1
								<Input
									id={`${question.key}-low`}
									value={question.low ?? ""}
									onChange={(event) => updateQuestion(index, { low: event.target.value })}
								/>
							</label>
							<label htmlFor={`${question.key}-high`} className="space-y-1 text-sm">
								Tekst ved 5
								<Input
									id={`${question.key}-high`}
									value={question.high ?? ""}
									onChange={(event) => updateQuestion(index, { high: event.target.value })}
								/>
							</label>
						</div>
					)}
					{question.type === "text" && (
						<label htmlFor={`${question.key}-placeholder`} className="block space-y-1 text-sm">
							Plassholder
							<Input
								id={`${question.key}-placeholder`}
								value={question.placeholder ?? ""}
								onChange={(event) => updateQuestion(index, { placeholder: event.target.value })}
							/>
						</label>
					)}
					{question.type === "options" && (
						<>
							<label htmlFor={`${question.key}-options`} className="block space-y-1 text-sm">
								Svaralternativer, ett per linje
								<Textarea
									id={`${question.key}-options`}
									value={question.options?.join("\n") ?? ""}
									onChange={(event) =>
										updateQuestion(index, { options: event.target.value.split("\n") })
									}
								/>
							</label>
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={question.allowOther ?? false}
									onChange={(event) => updateQuestion(index, { allowOther: event.target.checked })}
								/>
								Tillat eget svaralternativ
							</label>
						</>
					)}
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={index === 0}
							onClick={() => moveQuestion(index, -1)}
							aria-label={`Flytt spørsmål ${index + 1} opp`}
						>
							Flytt opp
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={index === fields.length - 1}
							onClick={() => moveQuestion(index, 1)}
							aria-label={`Flytt spørsmål ${index + 1} ned`}
						>
							Flytt ned
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onChange(fields.filter((field) => field.key !== question.key))}
							aria-label={`Fjern spørsmål ${index + 1}`}
						>
							Fjern
						</Button>
					</div>
				</fieldset>
			))}
			<Button
				type="button"
				variant="outline"
				disabled={fields.length >= 40}
				onClick={() => {
					// Stored answers refer to this key. Editing or moving a question must keep its key unchanged.
					onChange([
						...fields,
						{
							key: `question_${crypto.randomUUID().replaceAll("-", "")}`,
							label: "",
							type: "text",
							required: false,
						},
					]);
				}}
			>
				Legg til spørsmål
			</Button>
		</div>
	);
}
