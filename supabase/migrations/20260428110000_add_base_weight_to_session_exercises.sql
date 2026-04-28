alter table "public"."workout_session_exercises"
add column "base_weight_kg" numeric;

alter table "public"."workout_session_exercises"
add constraint "workout_session_exercises_base_weight_chk"
check (("base_weight_kg" is null) or ("base_weight_kg" >= (0)::numeric));
