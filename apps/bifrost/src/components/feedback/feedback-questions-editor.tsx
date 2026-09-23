"use client";

import type { FeedbackField } from "@workspace/shared/feedback";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";

export function FeedbackQuestionsEditor({
	fields,
	onChange,
	errors,
}: Readonly<{
	fields: FeedbackField[];
	onChange: (fields: FeedbackField[]) => void;
	errors?: Record<string, readonly { message: string }[]>;
}>) {
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
					<FieldError
						errors={Object.entries(errors ?? {})
							.filter(([path]) => path.startsWith(`fields[${index}].`))
							.flatMap(([, issues]) => issues)}
					/>
					<label htmlFor={`${question.key}-label`} className="block space-y-1 text-sm">
						<span>Spørsmålstekst</span>
						<Input
							id={`${question.key}-label`}
							value={question.label}
							onChange={(event) => updateQuestion(index, { label: event.target.value })}
						/>
					</label>
					<div className="space-y-1 text-sm">
						<label htmlFor={`${question.key}-type`}>Svarformat</label>
						<Select
							value={question.type}
							onValueChange={(value) =>
								updateQuestion(index, {
									type: value as FeedbackField["type"],
									options: value === "options" ? (question.options ?? [""]) : undefined,
								})
							}
						>
							<SelectTrigger id={`${question.key}-type`} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="rating">Vurdering fra 1 til 5</SelectItem>
								<SelectItem value="text">Fritekst</SelectItem>
								<SelectItem value="yesNo">Ja eller nei</SelectItem>
								<SelectItem value="options">Flervalg</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<Checkbox
							id={`${question.key}-required`}
							checked={question.required}
							onCheckedChange={(checked) => updateQuestion(index, { required: checked === true })}
						/>
						<label htmlFor={`${question.key}-required`}>Obligatorisk svar</label>
					</div>
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
									onBlur={(event) =>
										updateQuestion(index, {
											options: event.target.value
												.split("\n")
												.filter((option) => option.trim().length > 0),
										})
									}
									onChange={(event) =>
										updateQuestion(index, { options: event.target.value.split("\n") })
									}
								/>
							</label>
							<div className="flex items-center gap-2 text-sm">
								<Checkbox
									id={`${question.key}-allow-other`}
									checked={question.allowOther ?? false}
									onCheckedChange={(checked) =>
										updateQuestion(index, { allowOther: checked === true })
									}
								/>
								<label htmlFor={`${question.key}-allow-other`}>Tillat eget svaralternativ</label>
							</div>
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
