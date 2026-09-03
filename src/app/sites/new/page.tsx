import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/site-form";
import { requireUser } from "@/lib/auth/user";
import { createSite } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="현장 등록"
        subtitle="평수와 벽지 종류만 넣으면 견적이 자동으로 잡힙니다"
      />
      <SiteForm action={createSite} submitLabel="등록하기" />
    </>
  );
}
