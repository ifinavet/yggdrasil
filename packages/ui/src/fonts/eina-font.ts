import localFont from "next/font/local";

export const eina = localFont({
	src: [
		{
			path: "./eina/Eina01-Regular.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "./eina/Eina01-RegularItalic.woff2",
			weight: "400",
			style: "italic",
		},
		{
			path: "./eina/Eina01-SemiBold.woff2",
			weight: "600",
			style: "normal",
		},
		{
			path: "./eina/Eina01-SemiboldItalic.woff2",
			weight: "600",
			style: "italic",
		},
		{
			path: "./eina/Eina01-Bold.woff2",
			weight: "700",
			style: "normal",
		},
		{
			path: "./eina/Eina01-BoldItalic.woff2",
			weight: "700",
			style: "italic",
		},
	],
});
