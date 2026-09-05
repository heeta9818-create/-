import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/site-form";
import { requireUser } from "@/lib/auth/user";
import { getSiteRepository } from "@/lib/data/repository";
import { updateSite } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditSitePage(
  props: PageProps<"/sites/[id]/edit">,
) {
  const { id } = await props.params;
  const user = await requireUser();
  const repo = await getSiteRepository();
  const site = await repo.get(id, user.id);
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
