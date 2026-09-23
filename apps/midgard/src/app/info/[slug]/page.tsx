import { api } from "@workspace/backend/convex/api";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { Title } from "@workspace/ui/components/title";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import SanitizeHtml from "@/components/common/sanitize-html";
import { notFoundOnConvexError } from "@/lib/notFoundOnConvexError";

export default async function Page({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	"use cache";
	cacheLife("max");

	const { slug: identifier } = await params;

	const page = await fetchQuery(api.pages.queries.getByIdentifier, {
		identifier,
	}).catch(notFoundOnConvexError);

	return (
		<ResponsiveCenterContainer>
			<Title>{page.title}</Title>

			<div className="mx-auto rounded-xl bg-zinc-100 px-10 py-8 md:px-12 dark:bg-zinc-800">
				<SanitizeHtml html={page.content} className="prose dark:prose-invert max-w-[80ch]" />
			</div>
		</ResponsiveCenterContainer>
	);
}
