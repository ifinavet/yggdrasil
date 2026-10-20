import { WikiEditPage } from "@/components/wiki/editor";
export default async function EditPage({
	params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
	const { slug } = await params;
	return <WikiEditPage slug={slug} />;
}
