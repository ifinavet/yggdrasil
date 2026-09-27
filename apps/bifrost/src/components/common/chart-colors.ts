export const PRIMARY_SERIES_COLOR = "var(--primary)";
export const MUTED_SERIES_COLOR = "var(--muted-foreground)";
export const ACCENT_SERIES_COLOR = "var(--series-jobs)";

const DIMMED_SHARE = 35;
const MIN_HEAT_SHARE = 8;
const LIGHT_TEXT_FROM_HEAT = 0.6;

export function tinted(color: string, share: number) {
	return `color-mix(in oklch, ${color} ${Math.round(share)}%, transparent)`;
}

export function dimmed(color: string) {
	return tinted(color, DIMMED_SHARE);
}

export function heatTint(color: string, heat: number) {
	return tinted(color, Math.max(MIN_HEAT_SHARE, heat * 100));
}

export function needsLightText(heat: number) {
	return heat >= LIGHT_TEXT_FROM_HEAT;
}
