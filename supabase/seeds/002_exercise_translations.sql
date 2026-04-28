-- Seed localized exercise names.
-- Requires slugs from 001_exercises.sql.

with exercise_seed(slug, name_en, name_de) as (
  values
  ('assisted-dip', 'Assisted Dip', 'Unterstuetzter Dip'),
  ('back-squat', 'Back Squat', 'Kniebeuge'),
  ('barbell-bench-press', 'Barbell Bench Press', 'Langhantel-Bankdruecken'),
  ('barbell-bent-over-row', 'Barbell Bent Over Row', 'Vorgebeugtes Langhantelrudern'),
  ('barbell-hip-thrust', 'Barbell Hip Thrust', 'Langhantel Hip Thrust'),
  ('bent-over-reverse-dumbbell-flye', 'Bent Over Reverse Dumbbell Flye', 'Vorgebeugtes Reverse Flye mit Kurzhanteln'),
  ('bicycle-crunch', 'Bicycle Crunch', 'Bicycle Crunch'),
  ('cable-flye', 'Cable Flye', 'Kabel Flye'),
  ('cable-lateral-raise', 'Cable Lateral Raise', 'Seitheben am Kabel'),
  ('cable-reverse-flye', 'Cable Reverse Flye', 'Reverse Flye am Kabel'),
  ('cable-seated-row', 'Cable Seated Row', 'Sitzendes Kabelrudern'),
  ('cable-tricep-kickback', 'Cable Tricep Kickback', 'Trizeps Kickback am Kabel'),
  ('chest-supported-row', 'Chest-Supported Row', 'Brustgestuetztes Rudern'),
  ('chest-supported-t-bar-row', 'Chest-Supported T-Bar Row', 'Brustgestuetztes T-Stangen-Rudern'),
  ('close-grip-bench-press', 'Close-Grip Bench Press', 'Enges Bankdruecken'),
  ('crunch', 'Crunch', 'Crunch'),
  ('deadlift', 'Deadlift', 'Kreuzheben'),
  ('dumbbell-floor-press', 'Dumbbell Floor Press', 'Kurzhantel-Bodendruecken'),
  ('dumbbell-incline-press', 'Dumbbell Incline Press', 'Kurzhantel-Schraegbankdruecken'),
  ('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'Kurzhantel-Seitheben'),
  ('dumbbell-row', 'Dumbbell Row', 'Kurzhantelrudern'),
  ('dumbbell-seated-shoulder-press', 'Dumbbell Seated Shoulder Press', 'Sitzendes Kurzhantel-Schulterdruecken'),
  ('dumbbell-single-leg-hip-thrust', 'Dumbbell Single-Leg Hip Thrust', 'Einbeiniger Kurzhantel Hip Thrust'),
  ('dumbbell-skull-crusher', 'Dumbbell Skull Crusher', 'Kurzhantel Skull Crusher'),
  ('dumbbell-supinated-curl', 'Dumbbell Supinated Curl', 'Kurzhantel-Curl im Untergriff'),
  ('dumbbell-walking-lunge', 'Dumbbell Walking Lunge', 'Gehender Ausfallschritt mit Kurzhanteln'),
  ('ez-bar-curl', 'EZ Bar Curl', 'SZ-Curl'),
  ('goblet-squat', 'Goblet Squat', 'Kelchkniebeuge'),
  ('hammer-curl', 'Hammer Curl', 'Hammer-Bizepscurl'),
  ('hanging-leg-raise', 'Hanging Leg Raise', 'Haengendes Beinheben'),
  ('hip-abduction', 'Hip Abduction', 'Hueftabduktion'),
  ('lat-pulldown', 'Lat Pulldown', 'Latzug'),
  ('lying-leg-curl', 'Lying Leg Curl', 'Liegender Beinbeuger'),
  ('seated-leg-curl', 'Seated Leg Curl', 'Sitzender Beinbeuger'),
  ('leg-extension', 'Leg Extension', 'Beinstrecker'),
  ('leg-press', 'Leg Press', 'Beinpresse'),
  ('machine-incline-chest-press', 'Machine Incline Chest Press', 'Schraegbank-Brustpresse an der Maschine'),
  ('machine-seated-hip-abduction', 'Machine Seated Hip Abduction', 'Sitzende Hueftabduktion an der Maschine'),
  ('neutral-grip-pulldown', 'Neutral-Grip Pulldown', 'Latzug im Neutralgriff'),
  ('overhead-press', 'Overhead Press', 'Schulterdruecken'),
  ('pec-deck', 'Pec Deck', 'Butterfly'),
  ('plank', 'Plank', 'Unterarmstuetz'),
  ('reverse-grip-lat-pulldown', 'Reverse-Grip Lat Pulldown', 'Latzug im Untergriff'),
  ('reverse-pec-deck', 'Reverse Pec Deck', 'Reverse Butterfly'),
  ('romanian-deadlift', 'Romanian Deadlift', 'Rumaenisches Kreuzheben'),
  ('seated-face-pull', 'Seated Face Pull', 'Sitzender Face Pull'),
  ('single-arm-cable-curl', 'Single-Arm Cable Curl', 'Einarmiger Kabel Curl'),
  ('single-arm-pulldown', 'Single-Arm Pulldown', 'Einarmiger Latzug'),
  ('single-arm-rope-tricep-extension', 'Single-Arm Rope Tricep Extension', 'Einarmiges Trizepsdruecken mit Seil'),
  ('single-leg-leg-extension', 'Single-Leg Leg Extension', 'Einbeiniger Beinstrecker'),
  ('single-leg-lying-leg-curl', 'Single-Leg Lying Leg Curl', 'Einbeiniger liegender Beinbeuger'),
  ('standing-calf-raise', 'Standing Calf Raise', 'Stehendes Wadenheben')
),
translation_seed(slug, lang_code, name) as (
  select slug, 'en'::public.language_code, name_en from exercise_seed
  union all
  select slug, 'de'::public.language_code, name_de from exercise_seed
)
insert into public.exercise_translations (exercise_id, lang_code, name)
select e.id, ts.lang_code, ts.name
from translation_seed ts
join public.exercises e
  on e.slug = ts.slug
on conflict (exercise_id, lang_code) do update
set name = excluded.name;
