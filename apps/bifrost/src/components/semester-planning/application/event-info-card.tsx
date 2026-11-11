import {
	ESCAPE_LABELS,
	FOOD_PURCHASER_LABELS,
	VENUE_LABELS,
} from "@workspace/shared/semester/labels";
import { Panel, PanelBody } from "@workspace/ui/components/products/panel";
import type { ReactNode } from "react";
import { ProductName } from "@/components/products/product-name";
import { studentRange } from "../format";
import { EditEventInfo } from "./edit-details";
import type { Application } from "./model";
import { DetailList } from "./section";

/**
 * «Søknaden»: what the company asked for in the Hugin form, led by their own description. This is
 * what the editor reads first.
 */
export function EventInfoCard({ application }: Readonly<{ application: Application }>) {
	const audience = [...application.targetDegrees, ...application.targetStudyPrograms];

	const items: [string, ReactNode][] = [
		["Type", <ProductName key="type" row={application} />],
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
		<Panel title="Søknaden" aside={<EditEventInfo application={application} />}>
			<PanelBody>
				<p className="text-[15px] leading-relaxed break-words whitespace-pre-line">
					{application.description}
				</p>
				<div className="mt-4 border-t pt-4">
					<DetailList columns={2} items={items} />
				</div>
				{application.additionalInfo && (
					<div className="mt-3 text-[13.5px]">
						<p className="font-medium">Annet fra bedriften</p>
						<p className="text-muted-foreground mt-1 break-words whitespace-pre-line">
							{application.additionalInfo}
						</p>
					</div>
				)}
			</PanelBody>
		</Panel>
	);
}
