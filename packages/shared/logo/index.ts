import { z } from "zod";

export const LOGO_FORMAT_LABELS = {
	"image/png": "PNG",
	"image/svg+xml": "SVG",
	"image/webp": "WebP",
	"image/jpeg": "JPEG",
} as const;

export type LogoContentType = keyof typeof LOGO_FORMAT_LABELS;

export const LOGO_CONTENT_TYPES = Object.keys(LOGO_FORMAT_LABELS) as [
	LogoContentType,
	...LogoContentType[],
];
export const LOGO_ACCEPT = LOGO_CONTENT_TYPES.join(",");
export const LOGO_MAX_BYTES = 1_000_000;
export const LOGO_SOURCE_MAX_BYTES = 20_000_000;
export const LOGO_MAX_EDGE_PX = 1024;

const BYTES_PER_MB = 1_000_000;
const formatList = new Intl.ListFormat("nb", { type: "disjunction" }).format(
	Object.values(LOGO_FORMAT_LABELS),
);

export const LOGO_MESSAGES = {
	wrongType: `Logoen må være ${formatList}.`,
	tooLarge: `Logoen kan være høyst ${LOGO_MAX_BYTES / BYTES_PER_MB} MB.`,
	sourceTooLarge: `Filen kan være høyst ${LOGO_SOURCE_MAX_BYTES / BYTES_PER_MB} MB.`,
	notCompressible: "Vi klarte ikke å gjøre logoen liten nok. Prøv en enklere fil.",
	uploadFailed: "Opplastingen feilet. Prøv igjen.",
	hint: `${formatList}, høyst ${LOGO_SOURCE_MAX_BYTES / BYTES_PER_MB} MB.`,
} as const;

function logoFileSchema(maxBytes: number, tooLarge: string) {
	return z.object({
		contentType: z.enum(LOGO_CONTENT_TYPES, { error: LOGO_MESSAGES.wrongType }),
		size: z.number().max(maxBytes, tooLarge),
	});
}

export const storedLogoSchema = logoFileSchema(LOGO_MAX_BYTES, LOGO_MESSAGES.tooLarge);
export const sourceLogoSchema = logoFileSchema(LOGO_SOURCE_MAX_BYTES, LOGO_MESSAGES.sourceTooLarge);

function firstProblem(
	schema: ReturnType<typeof logoFileSchema>,
	contentType: string | undefined,
	size: number,
): string | null {
	const result = schema.safeParse({ contentType, size });
	return result.success ? null : (result.error.issues[0]?.message ?? LOGO_MESSAGES.wrongType);
}

export function logoProblem(contentType: string | undefined, size: number): string | null {
	return firstProblem(storedLogoSchema, contentType, size);
}

export function sourceLogoProblem(contentType: string | undefined, size: number): string | null {
	return firstProblem(sourceLogoSchema, contentType, size);
}
