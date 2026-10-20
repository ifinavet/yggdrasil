import { WikiArticlePage } from "@/components/wiki/article";
export default async function ArticlePage({
	params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
	const { slug } = await params;
	return <WikiArticlePage slug={slug} />;
}
