import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";

export default async function Page({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	"use cache";
	cacheLife("max");

	const { slug: identifier } = await params;

	const page = await fetchQuery(api.externalPages.getByIdentifier, {
		identifier,
	});

	return (
		<ResponsiveCenterContainer>
			<Title>{page.title}</Title>

			<div className="mx-auto rounded-xl bg-zinc-100 px-10 py-8 md:px-12 dark:bg-zinc-800">
				<SanitizeHtml
					html={page.content}
					className="prose dark:prose-invert max-w-[80ch]"
				/>
			</div>
		</ResponsiveCenterContainer>
	);
}
