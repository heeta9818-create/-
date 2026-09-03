import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/site-form";
import { getSiteRepository } from "@/lib/data/repository";
import { updateSite } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditSitePage(
  props: PageProps<"/sites/[id]/edit">,
) {
  const { id } = await props.params;
  const repo = await getSiteRepository();
  const site = await repo.get(id);
  if (!site) notFound();

  return (
    <>
      <PageHeader title="현장 수정" subtitle={site.customerName} />
      <SiteForm
        action={updateSite.bind(null, id)}
        site={site}
        submitLabel="저장하기"
      />
    </>
  );
}
