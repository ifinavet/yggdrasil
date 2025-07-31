import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import SanitizeHtml from "@/components/common/sanitize-html";
import { Title } from "@/components/common/title";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";

export default async function Page({ params }: { params: Promise<{ slug: Id<"externalPages"> }> }) {
  const id = (await params).slug;

  const page = await fetchQuery(api.externalPages.getById, { id })

  return (
    <ResponsiveCenterContainer>
      <Title>{page.title}</Title>

      <div className='mx-auto w-fit rounded-xl bg-zinc-100 px-10 py-8 md:px-12'>
        <SanitizeHtml html={page.content} className='prose max-w-[80ch]' />
      </div>
    </ResponsiveCenterContainer>
  );
}
