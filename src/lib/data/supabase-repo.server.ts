import {
  createSupabaseEstimateRepository,
  createSupabaseSettingsRepository,
  createSupabaseSiteRepository,
} from "./supabase-repo";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * 앱에서 쓰는 실제 저장소들.
 *
 * next/headers(쿠키)에 묶여 있어서 Next 밖에서는 부를 수 없다. 그래서
 * 쿼리 본체는 supabase-repo.ts에 두고 여기서 클라이언트만 꽂아 준다.
 * 테스트는 supabase-repo.ts를 직접 가져다 쓴다.
 */
export const supabaseSiteRepository =
  createSupabaseSiteRepository(createSupabaseServerClient);

export const supabaseEstimateRepository = createSupabaseEstimateRepository(
  createSupabaseServerClient,
);

export const supabaseSettingsRepository = createSupabaseSettingsRepository(
  createSupabaseServerClient,
);
