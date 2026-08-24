create table if not exists public.apps (
  app_id text primary key check (length(btrim(app_id)) > 0),
  title text not null,
  developer text,
  score double precision check (score between 0 and 5),
  reviews bigint check (reviews >= 0),
  installs text,
  size text,
  version text,
  android_version text,
  description text,
  screenshots jsonb not null default '[]'::jsonb
    check (jsonb_typeof(screenshots) = 'array'),
  updated_date timestamptz,
  source_url text not null,
  raw_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_data) = 'object'),
  last_fetched timestamptz not null default now()
);

comment on table public.apps is
  'Server-managed metadata from public app-store listing pages; never app-internal content.';
comment on column public.apps.raw_data is
  'Normalized public listing metadata saved by the server-side sync utility.';

alter table public.apps enable row level security;

revoke all on table public.apps from public, anon, authenticated;
grant select, insert, update on table public.apps to service_role;

