import { formatNokFromOre } from "../products";

type OrderAlert = Readonly<{
	company: string;
	type: string;
	title: string | readonly string[];
	additionalNotes?: string;
	estimatedRevenueOre?: number;
	url?: string;
}>;

function escapeSlack(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function formatOrderAlert({
	company,
	type,
	title,
	additionalNotes,
	estimatedRevenueOre,
	url,
}: OrderAlert) {
	const titles = Array.isArray(title) ? title : [title];
	return [
		"*💸 Ny bestilling*",
		`*Bedrift:* ${escapeSlack(company)}`,
		`*Type:* ${escapeSlack(type)}`,
		`*Tittel:* ${titles.map(escapeSlack).join(", ")}`,
		`*Estimert inntekt:* ${estimatedRevenueOre === undefined ? "Ikke beregnet" : `${escapeSlack(formatNokFromOre(estimatedRevenueOre))} eks. mva`}`,
		...(additionalNotes?.trim()
			? [`*Tilleggsinformasjon:* ${escapeSlack(additionalNotes.trim())}`]
			: []),
		...(url ? [`<${url}|Åpne i Bifrost>`] : []),
	].join("\n");
}
