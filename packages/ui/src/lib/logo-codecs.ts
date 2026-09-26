import type { LogoCodecs, RasterLogoContentType } from "./logo-compression";

const decoders = {
	"image/png": () => import("@jsquash/png/decode.js"),
	"image/jpeg": () => import("@jsquash/jpeg/decode.js"),
	"image/webp": () => import("@jsquash/webp/decode.js"),
} satisfies Record<
	RasterLogoContentType,
	() => Promise<{ default: (bytes: ArrayBuffer) => Promise<ImageData | null> }>
>;

async function decode(contentType: RasterLogoContentType, bytes: ArrayBuffer): Promise<ImageData> {
	const { default: decodeImage } = await decoders[contentType]();
	const image = await decodeImage(bytes);
	if (!image) throw new Error(`Could not decode ${contentType}`);
	return image;
}

async function optimisePng(image: ImageData): Promise<ArrayBuffer> {
	const { default: init, optimise_raw } = await import("@jsquash/oxipng/codec/pkg/squoosh_oxipng.js");
	await init();
	return optimise_raw(image.data, image.width, image.height, 2, false, true).buffer as ArrayBuffer;
}

async function encodeLossless(image: ImageData): Promise<readonly Blob[]> {
	const { default: encodeWebp } = await import("@jsquash/webp/encode.js");
	const [png, webp] = await Promise.all([optimisePng(image), encodeWebp(image, { lossless: 1 })]);
	return [new Blob([png], { type: "image/png" }), new Blob([webp], { type: "image/webp" })];
}

async function resize(image: ImageData, width: number, height: number): Promise<ImageData> {
	const { default: resizeImage } = await import("@jsquash/resize");
	return resizeImage(image, { width, height });
}

async function optimiseSvg(svg: string): Promise<string> {
	const { optimize } = await import("svgo/browser");
	return optimize(svg, { multipass: true, plugins: ["preset-default", "removeScripts"] }).data;
}

export const logoCodecs: LogoCodecs = { decode, encodeLossless, resize, optimiseSvg };
