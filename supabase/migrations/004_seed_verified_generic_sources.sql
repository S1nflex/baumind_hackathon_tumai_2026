-- Seed small, verified product-page sources. These URLs expose schema.org Product
-- JSON-LD and are suitable for the generic server-side adapter.
update public.price_sources
set enabled = false
where lower(base_url) in (
  'https://www.bauhaus.info/baustoffe/c/10000410',
  'https://www.hornbach.de/c/baustoffe/'
);

insert into public.price_sources (name, base_url, adapter_type, enabled)
select source.name, source.base_url, 'generic', true
from (
  values
    ('GLOBUS Schweißtisch', 'https://www.globus-baumarkt.de/p/holzmann-mobiler-schweisstisch-st2go-0760451514/'),
    ('HAGEBAU 3-Schichtplatte', 'https://www.hagebau.de/p/3-schichtplatte-anP04909255/'),
    ('HAGEBAU Flachtank', 'https://www.hagebau.de/p/4rain-flachtank-flat-s-1500-l-blau-anP7000317089/')
) as source(name, base_url)
where not exists (
  select 1
  from public.price_sources existing
  where existing.base_url = source.base_url
);
