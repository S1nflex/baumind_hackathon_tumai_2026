with ranked_prices as (
  select
    id,
    row_number() over (
      partition by source_id, sku, product_url, unit, pack_size, snapshot_date
      order by scraped_at desc, net_price asc, id
    ) as row_number
  from public.material_prices
)
delete from public.material_prices as prices
using ranked_prices
where prices.id = ranked_prices.id
  and ranked_prices.row_number > 1;

drop index if exists public.material_prices_supplier_week_unique;

alter table public.material_prices
  drop constraint if exists material_prices_weekly_snapshot_unique;

alter table public.material_prices
  add constraint material_prices_weekly_snapshot_unique
  unique nulls not distinct (source_id, sku, product_url, unit, pack_size, snapshot_date);
