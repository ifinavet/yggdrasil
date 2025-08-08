import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: identifier } = await params;

  const page = await fetchQuery(api.externalPages.getByIdentifier, { identifier })

  return (
    <ResponsiveCenterContainer>
      <Title>{page.title}</Title>

      <div className='mx-auto w-fit rounded-xl bg-zinc-100 px-10 py-8 md:px-12'>
        <SanitizeHtml html={page.content} className='prose max-w-[80ch]' />
      </div>
    </ResponsiveCenterContainer>
  );
}
