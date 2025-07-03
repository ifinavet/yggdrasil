import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { getInfoPageById } from "@/lib/query/pages";

export default async function Page({ params }: { params: Promise<{ slug: number }> }) {
  const id = (await params).slug;

  const page = await getInfoPageById(id)

  if (!page) {
    return <div>Hmm, vi fant ikke siden</div>;
  }

  return (
    <div className="grid gap-4 mx-6 md:mx-auto md:w-5/6 lg:w-4/5 xl:w-8/14">
      <Title>{page.title}</Title>

      <div className="rounded-xl bg-zinc-100 px-10 py-8 md:px-12">
        <SanitizeHtml html={page.content} className="prose max-w-[80ch]" />
      </div>

    </div>
  );
}
