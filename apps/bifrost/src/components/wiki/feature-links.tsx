"use client";
import type { GuideKey } from "@workspace/shared/guides";
import { Button } from "@workspace/ui/components/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const GUIDE_ARTICLES: Record<GuideKey, string> = {
	"events-list-guide-seen": "publisere-arrangement",
	"event-guide-seen": "holde-bedpress",
	"job-listings-guide-seen": "annonsebestilling",
	"organization-guide-seen": "medlemskontoer",
	"admissions-guide-seen": "opptaksperiode",
	"engagement-guide-seen": "prognoser",
};
const FEATURE_ARTICLES: Record<string, string> = {
	events: "holde-bedpress",
	"job-listings": "annonsebestilling",
	insight: "prognoser",
	leaderboard: "leaderboard",
	admissions: "opptaksperiode",
	students: "studenthjelp",
	organization: "medlemskontoer",
	companies: "bedriftshistorikk",
	products: "produkter",
	invoicing: "fakturering",
	semesterplan: "semesterplan",
	food: "praktisk-arrangement",
	"feedback-forms": "lage-skjema",
	pages: "offentlige-sider",
};
export function FeatureHelp() {
	const path = usePathname().split("/")[1] ?? "";
	const slug = FEATURE_ARTICLES[path];
	if (!slug) return null;
	return (
		<Button size="sm" variant="ghost" className="ml-auto" asChild>
			<Link href={`/wiki/${slug}`}>
				<BookOpen className="size-4" />
				<span>Hjelp</span>
			</Link>
		</Button>
	);
}
