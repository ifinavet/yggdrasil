import {
	ESCAPE_LABELS,
	EVENT_TYPE_LABELS,
	FOOD_PURCHASER_LABELS,
	VENUE_LABELS,
} from "@workspace/shared/semester/labels";
import type { ReactNode } from "react";
import { studentRange } from "../format";
import type { Application } from "./model";
import { DetailList, Section } from "./section";

/**
 * «Søknaden»: what the company asked for in the Hugin form, led by their own description. This is
 * what the editor reads first.
 */
export function EventInfoCard({ application }: Readonly<{ application: Application }>) {
	const audience = [...application.targetDegrees, ...application.targetStudyPrograms];

	const items: [string, ReactNode][] = [
		["Type", EVENT_TYPE_LABELS[application.eventType]],
		["Studenter", studentRange(application.minStudents, application.maxStudents)],
		["Sted", VENUE_LABELS[application.venue]],
		["Escape", ESCAPE_LABELS[application.wantsToUseEscape]],
		["Mat og drikke", application.foodAndDrinks ? "Ja" : "Nei"],
		[
			"Innkjøp",
			application.foodAndDrinks ? FOOD_PURCHASER_LABELS[application.foodPurchasedBy] : "–",
		],
	];
	if (audience.length > 0) items.push(["Målgruppe", audience.join(", ")]);

	return (
		<Section title="Søknaden">
			<p className="whitespace-pre-line break-words text-[15px] leading-relaxed">
				{application.description}
			</p>
			<div className="mt-4 border-t pt-4">
				<DetailList columns={2} items={items} />
			</div>
			{application.additionalInfo && (
				<div className="mt-3 text-[13.5px]">
					<p className="font-medium">Annet fra bedriften</p>
					<p className="mt-1 whitespace-pre-line break-words text-muted-foreground">
						{application.additionalInfo}
					</p>
				</div>
			)}
		</Section>
	);
}
