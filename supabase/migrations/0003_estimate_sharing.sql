-- 견적서 공개 링크
--
-- 고객은 로그인하지 않는다. 그래서 RLS를 그대로 두면 공개 견적서를 읽을 수
-- 없다. 테이블에 anon 읽기 정책을 열어 주는 건 위험하므로(정책 조건을
-- 잘못 쓰면 전부 새어나간다), 열쇠로만 한 건을 꺼내는 함수를 따로 만들고
-- 그 함수만 anon에게 준다.

-- 공유 열쇠를 만들 때 gen_random_bytes를 쓴다. pgcrypto에 들어 있고
-- Supabase 프로젝트에는 이미 켜져 있지만, 없는 환경을 대비해 확인한다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.estimates
  add column if not exists share_token text unique
    check (share_token is null or length(share_token) >= 32);

comment on column public.estimates.share_token is
  '고객용 공개 링크의 열쇠. null이면 공유가 꺼진 상태. 링크를 아는 사람은 누구나 볼 수 있다.';

/**
 * 열쇠로 공개 견적서 한 건을 꺼낸다.
 *
 * SECURITY DEFINER라 RLS를 우회한다. 그만큼 조심해야 해서:
 *  - 조건은 share_token 정확 일치 하나뿐이다
 *  - 돌려주는 컬럼을 명시적으로 고른다. memo(내부 메모), owner_id,
 *    연락처는 내보내지 않는다
 *  - search_path를 고정해 함수 안의 이름이 가로채이지 않게 한다
 */
create or replace function public.find_shared_estimate(p_token text)
returns table (
  version integer,
  label text,
  created_at timestamptz,
  input jsonb,
  result jsonb,
  customer_name text,
  address text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.version,
    coalesce(e.label, ''),
    e.created_at,
    e.input,
    e.result,
    s.customer_name,
    coalesce(s.address, '')
  from public.estimates e
  join public.sites s on s.id = e.site_id
  where e.share_token = p_token
    and p_token is not null
    and length(p_token) >= 32
  limit 1;
$$;

revoke all on function public.find_shared_estimate(text) from public;
grant execute on function public.find_shared_estimate(text) to anon, authenticated;

/**
 * 공개 링크를 켠다. 이미 켜져 있으면 기존 열쇠를 그대로 돌려준다 —
 * 고객에게 이미 보낸 링크가 다시 공유했다는 이유로 죽으면 안 된다.
 *
 * SECURITY INVOKER(기본값)이라 RLS가 그대로 걸린다.
 *
 * search_path를 고정한다. gen_random_bytes는 pgcrypto에 있고 Supabase는
 * 그걸 extensions 스키마에 둔다. 호출자의 search_path에 기대면 설정이 조금만
 * 달라도 "function gen_random_bytes does not exist"로 죽는다.
 * (public도 넣어 둔다. pgcrypto를 public에 설치한 프로젝트도 있다.)
 */
create or replace function public.enable_estimate_sharing(p_estimate_id uuid)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  select share_token into v_token
    from public.estimates
   where id = p_estimate_id
     and owner_id = auth.uid();

  if not found then
    return null;
  end if;

  if v_token is not null then
    return v_token;
  end if;

  -- 128비트 무작위. 링크를 아는 사람은 누구나 볼 수 있으므로 추측 불가능해야 한다.
  v_token := encode(gen_random_bytes(16), 'hex');

  update public.estimates
     set share_token = v_token
   where id = p_estimate_id
     and owner_id = auth.uid();

  return v_token;
end;
$$;

-- 공개 링크를 켜고 끄려면 update가 필요하다. 0002에서는 견적을 고치지
-- 않는다는 전제로 update 정책을 아예 만들지 않았는데, share_token만은 예외다.
drop policy if exists "본인 견적 공유 설정" on public.estimates;
create policy "본인 견적 공유 설정" on public.estimates
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- RLS는 행 단위라 "share_token만 고칠 수 있다"를 표현하지 못한다. 정책만
-- 열어 두면 저장된 result를 고쳐 쓸 수 있게 되어, 견적 스냅샷이 변하지
-- 않는다는 전제가 깨진다. 컬럼 권한으로 막는다.
revoke update on public.estimates from anon, authenticated;
grant update (share_token) on public.estimates to authenticated;
