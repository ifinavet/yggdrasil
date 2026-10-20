import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { ArticleLink } from "../wiki/shared";

export default async function FavoriteResources() {
	const token = await getAuthToken();
	const home = await fetchQuery(api.wiki.queries.home, {}, { token });
	const articles = home.bookmarks.length ? home.bookmarks : home.recommended;
	return (
		<div className="space-y-3">
			{articles.map((article) => (
				<ArticleLink key={article._id} article={article} />
			))}
			<Link href="/wiki" className="inline-block text-sm underline">
				Åpne Navet-håndboken
			</Link>
		</div>
	);
}
