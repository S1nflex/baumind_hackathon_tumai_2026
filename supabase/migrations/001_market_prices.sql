create extension if not exists pgcrypto;

create table if not exists public.price_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  adapter_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.material_prices (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.price_sources(id) on delete cascade,
  sku text not null,
  material_name text not null,
  normalized_name text not null,
  category text not null,
  unit text not null,
  pack_size numeric,
  net_price numeric not null,
  gross_price numeric not null,
  shipping_cost numeric,
  currency text not null default 'EUR',
  supplier_name text not null,
  product_url text not null,
  snapshot_date date not null default (date_trunc('week', now()))::date,
  scraped_at timestamptz not null default now()
);

alter table public.material_prices
  add constraint material_prices_weekly_snapshot_unique
  unique (source_id, sku, product_url, snapshot_date);

create index if not exists material_prices_sku_idx on public.material_prices (sku);
create index if not exists material_prices_normalized_name_idx on public.material_prices (normalized_name);
create index if not exists material_prices_category_idx on public.material_prices (category);
create index if not exists material_prices_scraped_at_idx on public.material_prices (scraped_at desc);
create index if not exists material_prices_latest_lookup_idx
  on public.material_prices (normalized_name, scraped_at desc, source_id);

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  items_collected integer not null default 0,
  error_log jsonb not null default '[]'::jsonb
);

create index if not exists scrape_runs_started_at_idx on public.scrape_runs (started_at desc);

create or replace view public.latest_material_price_stats as
with latest_per_supplier as (
  select distinct on (normalized_name, source_id)
    normalized_name,
    source_id,
    net_price,
    scraped_at
  from public.material_prices
  order by normalized_name, source_id, scraped_at desc
)
select
  normalized_name,
  avg(net_price) as avg_net_price,
  min(net_price) as min_net_price,
  max(net_price) as max_net_price,
  count(distinct source_id) as supplier_count,
  max(scraped_at) as last_scraped_at
from latest_per_supplier
group by normalized_name;

