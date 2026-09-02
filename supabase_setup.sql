-- 봉주르후르츠 픽업앱 데이터 저장용 테이블
-- Supabase 대시보드 → SQL Editor 에 이 내용을 붙여넣고 "Run" 하세요.

create table if not exists public.kv_store (
  key   text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- 저장 시각 자동 갱신
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kv_updated on public.kv_store;
create trigger trg_kv_updated
  before update on public.kv_store
  for each row execute function public.set_updated_at();

-- 참고: 서버는 service_role 키로 접속하므로 RLS(행 수준 보안)는 꺼둬도 됩니다.
-- service_role 키는 절대 외부에 노출하면 안 되며, Render 환경변수에만 넣어주세요.
alter table public.kv_store disable row level security;
