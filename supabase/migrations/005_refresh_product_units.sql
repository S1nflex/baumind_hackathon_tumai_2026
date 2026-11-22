-- Individual product pages do not expose a reliable LV-style unit in every JSON-LD
-- payload. The generic adapter now classifies each such product as a piece (St).
-- Refresh existing records from the three verified product sources.
update public.material_prices
set unit = 'St', pack_size = 1
where source_id in (
  select id
  from public.price_sources
  where lower(base_url) in (
    'https://www.globus-baumarkt.de/p/holzmann-mobiler-schweisstisch-st2go-0760451514/',
    'https://www.hagebau.de/p/3-schichtplatte-anp04909255/',
    'https://www.hagebau.de/p/4rain-flachtank-flat-s-1500-l-blau-anp7000317089/'
  )
);
