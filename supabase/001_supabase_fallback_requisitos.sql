-- =========================================================
-- Supabase fallback para app Requisitos
-- Objetivo: BDLocal trabaja todo el día, Firebase es nube principal,
-- y Supabase guarda/lee datos cuando Firebase esté pausado o falle.
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- =========================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.app_records (
  id text primary key,
  module_key text not null default 'requisitos',
  table_key text not null,
  record_key text not null,
  periodo_id text,
  estudiante_id text,
  source text not null default 'bdlocal',
  sync_status text not null default 'sincronizado',
  schema_version text not null default '1',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_key, table_key, record_key)
);

create table if not exists public.app_schemas (
  id text primary key,
  module_key text not null default 'requisitos',
  table_key text not null,
  field_key text not null,
  field_type text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  sample_value jsonb,
  status text not null default 'detectado',
  unique (module_key, table_key, field_key)
);

create table if not exists public.sync_log_cloud (
  id uuid primary key default gen_random_uuid(),
  module_key text not null default 'requisitos',
  provider text not null default 'supabase',
  action text not null,
  status text not null default 'ok',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id text primary key,
  module_key text not null default 'requisitos',
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_records_module_table on public.app_records(module_key, table_key);
create index if not exists idx_app_records_periodo on public.app_records(periodo_id);
create index if not exists idx_app_records_estudiante on public.app_records(estudiante_id);
create index if not exists idx_app_records_updated on public.app_records(updated_at desc);
create index if not exists idx_app_records_payload_gin on public.app_records using gin(payload);

create index if not exists idx_app_schemas_module_table on public.app_schemas(module_key, table_key);
create index if not exists idx_sync_log_cloud_created on public.sync_log_cloud(created_at desc);

alter table public.app_records enable row level security;
alter table public.app_schemas enable row level security;
alter table public.sync_log_cloud enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists app_records_select_anon on public.app_records;
create policy app_records_select_anon on public.app_records for select to anon using (true);
drop policy if exists app_records_insert_anon on public.app_records;
create policy app_records_insert_anon on public.app_records for insert to anon with check (true);
drop policy if exists app_records_update_anon on public.app_records;
create policy app_records_update_anon on public.app_records for update to anon using (true) with check (true);

drop policy if exists app_schemas_select_anon on public.app_schemas;
create policy app_schemas_select_anon on public.app_schemas for select to anon using (true);
drop policy if exists app_schemas_insert_anon on public.app_schemas;
create policy app_schemas_insert_anon on public.app_schemas for insert to anon with check (true);
drop policy if exists app_schemas_update_anon on public.app_schemas;
create policy app_schemas_update_anon on public.app_schemas for update to anon using (true) with check (true);

drop policy if exists sync_log_cloud_select_anon on public.sync_log_cloud;
create policy sync_log_cloud_select_anon on public.sync_log_cloud for select to anon using (true);
drop policy if exists sync_log_cloud_insert_anon on public.sync_log_cloud;
create policy sync_log_cloud_insert_anon on public.sync_log_cloud for insert to anon with check (true);

drop policy if exists system_settings_select_anon on public.system_settings;
create policy system_settings_select_anon on public.system_settings for select to anon using (true);
drop policy if exists system_settings_insert_anon on public.system_settings;
create policy system_settings_insert_anon on public.system_settings for insert to anon with check (true);
drop policy if exists system_settings_update_anon on public.system_settings;
create policy system_settings_update_anon on public.system_settings for update to anon using (true) with check (true);

drop trigger if exists trg_app_records_updated_at on public.app_records;
create trigger trg_app_records_updated_at
before update on public.app_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_system_settings_updated_at on public.system_settings;
create trigger trg_system_settings_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();
