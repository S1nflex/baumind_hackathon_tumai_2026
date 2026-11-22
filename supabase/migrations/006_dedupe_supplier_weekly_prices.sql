with ranked_prices as (
  select
    id,
    row_number() over (
      partition by normalized_name, supplier_name, snapshot_date
      order by scraped_at desc, net_price asc, id
    ) as row_number
  from public.material_prices
)
delete from public.material_prices as prices
using ranked_prices
where prices.id = ranked_prices.id
  and ranked_prices.row_number > 1;

create unique index if not exists material_prices_supplier_week_unique
  on public.material_prices (normalized_name, supplier_name, snapshot_date);
