-- Seed default base weight for barbell-based exercises.
-- Applies to all existing users and is safe to re-run.

with barbell_exercise_slugs(slug) as (
  values
    ('back-squat'),
    ('barbell-bench-press'),
    ('barbell-bent-over-row'),
    ('barbell-hip-thrust'),
    ('close-grip-bench-press'),
    ('deadlift'),
    ('overhead-press'),
    ('romanian-deadlift')
)
insert into public.user_exercise_defaults (user_id, exercise_id, default_base_weight_kg)
select
  u.id,
  e.id,
  20
from public.app_users u
join public.exercises e
  on e.slug in (select slug from barbell_exercise_slugs)
on conflict (user_id, exercise_id) do update
set
  default_base_weight_kg = excluded.default_base_weight_kg,
  updated_at = now();
