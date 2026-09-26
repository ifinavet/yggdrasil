import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

class NodeImageData {
	readonly colorSpace = "srgb";
	constructor(
		readonly data: Uint8ClampedArray,
		readonly width: number,
		readonly height: number,
	) {}
}

async function wasm(path: string): Promise<WebAssembly.Module> {
	return WebAssembly.compile(await readFile(require.resolve(path)));
}

export async function initLogoCodecsForNode(): Promise<void> {
	globalThis.ImageData ??= NodeImageData as unknown as typeof ImageData;
	const [png, oxipng, webpDecode, webpEncode, resize] = await Promise.all([
		import("@jsquash/png/decode.js"),
		import("@jsquash/oxipng/codec/pkg/squoosh_oxipng.js"),
		import("@jsquash/webp/decode.js"),
		import("@jsquash/webp/encode.js"),
		import("@jsquash/resize"),
	]);
	await Promise.all([
		png.init(await wasm("@jsquash/png/codec/pkg/squoosh_png_bg.wasm")),
		oxipng.default(await wasm("@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm")),
		webpDecode.init(await wasm("@jsquash/webp/codec/dec/webp_dec.wasm")),
		webpEncode.init(await wasm("@jsquash/webp/codec/enc/webp_enc_simd.wasm")),
		resize.initResize(await wasm("@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm")),
	]);
}
