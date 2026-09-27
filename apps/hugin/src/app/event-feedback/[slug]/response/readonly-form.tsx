"use client";

import { MIDGARD_URL } from "@workspace/shared/constants";
import { cn } from "@workspace/ui/lib/utils";
import {
	improvementsQuestion,
	optionsQuestion,
	otherQuestion,
	ratingQuestions,
	toughtsQuestion,
	yesNoQuestion,
} from "@/lib/event-feedback-questions";

export interface ResponseData {
	satisfaction: number;
	impression: number;
	expectation: number;
	toughts: string;
	improvements: string;
	want_to_work: string;
	word_of_mouth: string[];
	other: string;
}

function AnswerRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
	return (
		<div className="mt-[18px] border-border border-t pt-[14px]">
			<p className="m-0 mb-2 font-semibold text-[13.5px]">{label}</p>
			{children}
		</div>
	);
}

function AnswerText({ value }: Readonly<{ value: string }>) {
	if (!value)
		return <p className="m-0 mb-1 text-[15px] text-muted-foreground italic">Ikke besvart</p>;

	return <p className="m-0 mb-1 whitespace-pre-line text-[15px] text-foreground">{value}</p>;
}

export function ReadonlyEventResponseForm({ data }: Readonly<{ data: ResponseData }>) {
	return (
		<div className="flex flex-1 flex-col">
			<div className="flex-1">
				{ratingQuestions.map((question) => (
					<AnswerRow key={question.id} label={question.label}>
						<p className="sr-only">
							Svart {data[question.id]} av 5, der 1 er {question.low.toLowerCase()} og 5 er{" "}
							{question.high.toLowerCase()}.
						</p>
						<div aria-hidden="true" className="grid grid-cols-5 gap-1.5">
							{[1, 2, 3, 4, 5].map((rating) => (
								<span
									key={rating}
									className={cn(
										"grid h-[38px] place-items-center rounded-[10px] border font-semibold text-[14px]",
										data[question.id] === rating
											? "border-primary bg-primary text-primary-foreground"
											: "border-input bg-card",
									)}
								>
									{rating}
								</span>
							))}
						</div>
						<div
							aria-hidden="true"
							className="mt-2 flex justify-between gap-3 text-[12.5px] text-muted-foreground"
						>
							<span className="max-w-[46%]">{question.low}</span>
							<span className="max-w-[46%] text-right">{question.high}</span>
						</div>
					</AnswerRow>
				))}

				<AnswerRow label={toughtsQuestion.label}>
					<AnswerText value={data.toughts} />
				</AnswerRow>

				<AnswerRow label={improvementsQuestion.label}>
					<AnswerText value={data.improvements} />
				</AnswerRow>

				<AnswerRow label={yesNoQuestion.label}>
					<p className="m-0 mb-1 text-[15px] text-foreground">
						{data.want_to_work === "ja" ? "Ja" : "Nei"}
					</p>
				</AnswerRow>

				<AnswerRow label={optionsQuestion.label}>
					<div className="flex flex-wrap gap-1.5">
						{data.word_of_mouth.map((option) => (
							<span
								key={option}
								className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--primary)_26%,var(--input))] bg-[color-mix(in_oklab,var(--primary-light)_70%,var(--card))] px-2.5 py-1.5 font-medium text-[13.5px]"
							>
								{option}
							</span>
						))}
					</div>
				</AnswerRow>

				<AnswerRow label={otherQuestion.label}>
					<AnswerText value={data.other} />
				</AnswerRow>

				<div className="h-8" />
			</div>

			<div className="sticky bottom-0 z-6 border-border border-t bg-[color-mix(in_oklab,var(--background)_92%,transparent)] py-3 backdrop-blur-[6px]">
				<a
					href={MIDGARD_URL}
					className="grid h-[52px] w-full place-items-center rounded-[13px] border border-input font-semibold text-[15.5px] text-primary"
				>
					Tilbake til ifinavet.no
				</a>
			</div>
		</div>
	);
}
