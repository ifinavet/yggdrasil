import {
	LOGO_MAX_BYTES,
	LOGO_MAX_EDGE_PX,
	LOGO_MESSAGES,
	type LogoContentType,
	sourceLogoProblem,
} from "@workspace/shared/logo";

export type RasterLogoContentType = Exclude<LogoContentType, "image/svg+xml">;

export type LogoCodecs = Readonly<{
	decode: (contentType: RasterLogoContentType, bytes: ArrayBuffer) => Promise<ImageData>;
	encodeLossless: (image: ImageData) => Promise<readonly Blob[]>;
	resize: (image: ImageData, width: number, height: number) => Promise<ImageData>;
	optimiseSvg: (svg: string) => Promise<string>;
}>;

export class LogoCompressionError extends Error {}

function smallest(blobs: readonly Blob[]): Blob {
	return blobs.reduce((best, blob) => (blob.size < best.size ? blob : best));
}

function fitsStorage(blob: Blob): boolean {
	return blob.size <= LOGO_MAX_BYTES;
}

function displaySize(image: ImageData): Readonly<{ width: number; height: number }> | null {
	const longestEdge = Math.max(image.width, image.height);
	if (longestEdge <= LOGO_MAX_EDGE_PX) return null;
	const scale = LOGO_MAX_EDGE_PX / longestEdge;
	return {
		width: Math.max(1, Math.round(image.width * scale)),
		height: Math.max(1, Math.round(image.height * scale)),
	};
}

async function compressSvg(file: Blob, codecs: LogoCodecs): Promise<Blob> {
	const optimised = new Blob([await codecs.optimiseSvg(await file.text())], { type: file.type });
	const best = smallest([file, optimised]);
	if (!fitsStorage(best)) throw new LogoCompressionError(LOGO_MESSAGES.tooLarge);
	return best;
}

async function compressRaster(
	file: Blob,
	contentType: RasterLogoContentType,
	codecs: LogoCodecs,
): Promise<Blob> {
	const image = await codecs.decode(contentType, await file.arrayBuffer());
	const lossless = smallest([file, ...(await codecs.encodeLossless(image))]);
	if (fitsStorage(lossless)) return lossless;

	const target = displaySize(image);
	if (!target) throw new LogoCompressionError(LOGO_MESSAGES.notCompressible);
	const downscaled = await codecs.resize(image, target.width, target.height);
	const fallback = smallest(await codecs.encodeLossless(downscaled));
	if (!fitsStorage(fallback)) throw new LogoCompressionError(LOGO_MESSAGES.notCompressible);
	return fallback;
}

export async function compressLogo(file: Blob, codecs: LogoCodecs): Promise<Blob> {
	const problem = sourceLogoProblem(file.type, file.size);
	if (problem) throw new LogoCompressionError(problem);
	const contentType = file.type as LogoContentType;
	if (contentType === "image/svg+xml") return compressSvg(file, codecs);
	return compressRaster(file, contentType, codecs);
}
