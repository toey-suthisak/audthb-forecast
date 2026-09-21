-- The hand-curated event_calendar named this release "Labour Force,
-- Australia" (ABS's own report title). The ForexFactory-sourced
-- economic_consensus table (added 2026-09-20) names the same real
-- release "Employment Change" / "Unemployment Rate" instead -- same
-- event, two data sources, never reconciled, so the Event Risk alert
-- (reads event_calendar) and Market Consensus (reads economic_consensus)
-- showed what looked like two unrelated things for one release.
--
-- Renamed to "Employment Change" to match ForexFactory's naming, since
-- that's the more visible/primary number of the release from a trader's
-- perspective and Market Consensus already surfaces it under that name.
update public.event_calendar
set event_name = 'Employment Change'
where country = 'AU' and event_name = 'Labour Force, Australia';
