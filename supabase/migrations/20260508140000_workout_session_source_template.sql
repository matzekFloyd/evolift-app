alter table "public"."workout_sessions"
  add column "source_template_id" uuid
  references "public"."workout_templates"("id")
  on delete set null;

create index "idx_workout_sessions_source_template"
  on "public"."workout_sessions" using btree ("source_template_id")
  where ("source_template_id" is not null);

create or replace function "public"."instantiate_workout_template"(
  "p_template_id" uuid,
  "p_performed_on" date,
  "p_notes" text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from "public"."workout_templates" "wt"
    where ("wt"."id" = "p_template_id") and ("wt"."user_id" = v_user_id)
  ) then
    raise exception 'Template not found';
  end if;

  if "p_performed_on" is null then
    raise exception 'Performed date required';
  end if;

  insert into "public"."workout_sessions" (
    "user_id",
    "performed_on",
    "notes",
    "source_template_id"
  )
  values (
    v_user_id,
    "p_performed_on",
    nullif(trim("p_notes"), ''),
    "p_template_id"
  )
  returning "id" into v_session_id;

  insert into "public"."workout_session_exercises" (
    "session_id",
    "exercise_id",
    "position",
    "target_sets",
    "target_reps",
    "target_weight_kg",
    "base_weight_kg",
    "notes"
  )
  select
    v_session_id,
    "wte"."exercise_id",
    "wte"."position",
    "wte"."target_sets",
    "wte"."target_reps",
    "wte"."target_weight_kg",
    "wte"."base_weight_kg",
    "wte"."notes"
  from "public"."workout_template_exercises" as "wte"
  where "wte"."template_id" = "p_template_id"
  order by "wte"."position";

  return v_session_id;
end;
$$;

alter function "public"."instantiate_workout_template"(uuid, date, text) owner to postgres;

revoke all on function "public"."instantiate_workout_template"(uuid, date, text) from public;
grant execute on function "public"."instantiate_workout_template"(uuid, date, text) to authenticated;
grant execute on function "public"."instantiate_workout_template"(uuid, date, text) to service_role;
