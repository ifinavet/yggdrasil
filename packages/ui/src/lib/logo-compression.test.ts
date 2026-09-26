import {
	LOGO_MAX_BYTES,
	LOGO_MAX_EDGE_PX,
	LOGO_MESSAGES,
	LOGO_SOURCE_MAX_BYTES,
	logoProblem,
	sourceLogoProblem,
} from "@workspace/shared/logo";
import { beforeAll, describe, expect, it } from "vitest";
import { initLogoCodecsForNode } from "../test/init-logo-codecs";
import { logoCodecs } from "./logo-codecs";
import { compressLogo, LogoCompressionError, type RasterLogoContentType } from "./logo-compression";

const SLOW_TEST_MS = 120_000;

function opaqueImage(
	width: number,
	height: number,
	channel: (x: number, y: number, channel: number) => number,
): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const offset = (y * width + x) * 4;
			for (let c = 0; c < 3; c++) data[offset + c] = channel(x, y, c);
			data[offset + 3] = 255;
		}
	}
	return new ImageData(data, width, height);
}

function seededRandom() {
	let state = 0x2545f491;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 2 ** 32;
	};
}

function seededNoise(levels: number) {
	const random = seededRandom();
	return () => Math.floor(random() * levels) * Math.floor(256 / levels);
}

async function pngOf(image: ImageData): Promise<Blob> {
	const { default: optimise } = await import("@jsquash/oxipng/optimise.js");
	return new Blob([await optimise(image, { level: 0 })], { type: "image/png" });
}

async function decoded(blob: Blob): Promise<ImageData> {
	return logoCodecs.decode(blob.type as RasterLogoContentType, await blob.arrayBuffer());
}

async function refusal(promise: Promise<unknown>): Promise<string> {
	const error = await promise.then(
		() => null,
		(reason: unknown) => reason,
	);
	expect(error).toBeInstanceOf(LogoCompressionError);
	return (error as LogoCompressionError).message;
}

beforeAll(initLogoCodecsForNode);

describe("logo rules", () => {
	it("accepts every supported format within the storage limit", () => {
		for (const type of ["image/png", "image/svg+xml", "image/webp", "image/jpeg"]) {
			expect(logoProblem(type, LOGO_MAX_BYTES)).toBeNull();
		}
	});

	it("rejects other types, a missing type and files above the storage limit", () => {
		expect(logoProblem(undefined, 1000)).toBe("Logoen må være PNG, SVG, WebP eller JPEG.");
		expect(logoProblem("image/gif", 1000)).toBe("Logoen må være PNG, SVG, WebP eller JPEG.");
		expect(logoProblem("image/png", LOGO_MAX_BYTES + 1)).toBe("Logoen kan være høyst 1 MB.");
	});

	it("lets source files be larger than the stored logo", () => {
		expect(sourceLogoProblem("image/png", LOGO_MAX_BYTES * 5)).toBeNull();
		expect(sourceLogoProblem("image/png", LOGO_SOURCE_MAX_BYTES + 1)).toBe(
			"Filen kan være høyst 20 MB.",
		);
	});
});

describe("compressLogo", () => {
	it("refuses unsupported and oversized source files before decoding", async () => {
		expect(await refusal(compressLogo(new Blob(["x"], { type: "image/gif" }), logoCodecs))).toBe(
			LOGO_MESSAGES.wrongType,
		);
		const huge = new Blob([new Uint8Array(LOGO_SOURCE_MAX_BYTES + 1)], { type: "image/png" });
		expect(await refusal(compressLogo(huge, logoCodecs))).toBe(LOGO_MESSAGES.sourceTooLarge);
	});

	it(
		"shrinks a raster logo losslessly without changing a pixel",
		async () => {
			const image = opaqueImage(1600, 800, (x, y, c) => (c === 0 ? (x >> 4) * 16 : (y >> 5) * 8));
			const source = await pngOf(image);

			const logo = await compressLogo(source, logoCodecs);

			expect(logo.size).toBeLessThan(source.size);
			const result = await decoded(logo);
			expect([result.width, result.height]).toEqual([1600, 800]);
			expect(Buffer.from(result.data).equals(Buffer.from(image.data))).toBe(true);
		},
		SLOW_TEST_MS,
	);

	it(
		"downscales to the largest display size when lossless is not enough",
		async () => {
			const noise = seededNoise(2);
			let grey = 0;
			const image = opaqueImage(4800, 2400, (_x, _y, channel) => {
				if (channel === 0) grey = noise();
				return grey;
			});
			const source = await pngOf(image);
			expect(source.size).toBeGreaterThan(LOGO_MAX_BYTES);

			const logo = await compressLogo(source, logoCodecs);

			expect(logo.size).toBeLessThanOrEqual(LOGO_MAX_BYTES);
			const result = await decoded(logo);
			expect([result.width, result.height]).toEqual([LOGO_MAX_EDGE_PX, LOGO_MAX_EDGE_PX / 2]);
		},
		SLOW_TEST_MS,
	);

	it(
		"refuses a logo that stays too large at the display size",
		async () => {
			const noise = seededNoise(256);
			const source = await pngOf(opaqueImage(LOGO_MAX_EDGE_PX, LOGO_MAX_EDGE_PX, noise));

			expect(await refusal(compressLogo(source, logoCodecs))).toBe(LOGO_MESSAGES.notCompressible);
		},
		SLOW_TEST_MS,
	);

	it("strips scripts and whitespace from an SVG logo", async () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
			<script>alert(1)</script>
			<!-- editor metadata -->
			<rect   x="0"   y="0"   width="10"   height="10"   fill="#ff0000" />
		</svg>`;
		const source = new Blob([svg], { type: "image/svg+xml" });

		const logo = await compressLogo(source, logoCodecs);

		const text = await logo.text();
		expect(logo.type).toBe("image/svg+xml");
		expect(logo.size).toBeLessThan(source.size);
		expect(text).not.toContain("script");
		expect(text).toContain('viewBox="0 0 10 10"');
	});

	it("refuses an SVG that is still above the storage limit after optimising", async () => {
		const random = seededRandom();
		const letters = Array.from({ length: LOGO_MAX_BYTES + 1 }, () =>
			String.fromCharCode(97 + Math.floor(random() * 26)),
		).join("");
		const source = new Blob([`<svg xmlns="http://www.w3.org/2000/svg"><text>${letters}</text></svg>`], {
			type: "image/svg+xml",
		});

		expect(await refusal(compressLogo(source, logoCodecs))).toBe(LOGO_MESSAGES.tooLarge);
	});
});
