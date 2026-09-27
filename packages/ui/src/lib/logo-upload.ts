import { LOGO_MESSAGES } from "@workspace/shared/logo";
import { convexErrorMessage } from "@workspace/shared/utils";
import { logoCodecs } from "./logo-codecs";
import { compressLogo, type LogoCodecs, LogoCompressionError } from "./logo-compression";

const UPLOAD_TIMEOUT_MS = 60_000;

export type UploadedLogo = Readonly<{ storageId: string; previewUrl: string }>;

export async function uploadLogo(
	file: Blob,
	generateUploadUrl: () => Promise<string>,
	codecs: LogoCodecs = logoCodecs,
): Promise<UploadedLogo> {
	const logo = await compressLogo(file, codecs);
	const response = await fetch(await generateUploadUrl(), {
		method: "POST",
		headers: { "Content-Type": logo.type },
		body: logo,
		signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(LOGO_MESSAGES.uploadFailed);
	const { storageId } = (await response.json()) as { storageId: string };
	return { storageId, previewUrl: URL.createObjectURL(logo) };
}

export function logoUploadErrorMessage(
	error: unknown,
	fallback: string = LOGO_MESSAGES.uploadFailed,
): string {
	if (error instanceof LogoCompressionError) return error.message;
	return convexErrorMessage(error, fallback);
}
