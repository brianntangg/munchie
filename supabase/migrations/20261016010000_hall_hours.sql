-- Weekly hours of operation per dining hall, loaded from the NetNutrition scraper (see scraper/export_hall_hours.py).
-- Shape: {"Monday": [["07:00", "15:00"]], ...} for all seven days; an empty list is a closed day.
-- A close at or before the open means the shift ends after midnight. Null means hours are unknown.
alter table public.dining_halls add column hours jsonb;
alter table public.dining_halls add constraint dining_halls_hours_shape check (
  hours is null or (
    jsonb_typeof(hours) = 'object'
    and hours ?& array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  )
);
-- Members already read halls; hours are written by the importer, never by app clients.
