create table "public"."workout_templates" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "name" text not null,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "workout_templates_pkey" primary key ("id"),
  constraint "workout_templates_name_nonempty_chk"
    check (length(trim(both from "name")) > 0),
  constraint "workout_templates_user_id_fkey"
    foreign key ("user_id") references "auth"."users"("id") on delete cascade
);

create unique index "workout_templates_user_lower_name_uniq"
  on "public"."workout_templates" using btree ("user_id", lower("name"));

create index "idx_workout_templates_user"
  on "public"."workout_templates" using btree ("user_id");

create trigger "trg_workout_templates_set_updated_at"
before update on "public"."workout_templates"
for each row execute function "public"."set_updated_at"();

create table "public"."workout_template_exercises" (
  "id" uuid default gen_random_uuid() not null,
  "template_id" uuid not null,
  "exercise_id" uuid not null,
  "position" integer not null,
  "target_sets" integer,
  "target_reps" integer,
  "target_weight_kg" numeric(6,2),
  "base_weight_kg" numeric(6,2),
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  constraint "workout_template_exercises_pkey" primary key ("id"),
  constraint "workout_template_exercises_position_chk" check (("position" > 0)),
  constraint "workout_template_exercises_target_reps_chk"
    check ((("target_reps" is null) or ("target_reps" > 0))),
  constraint "workout_template_exercises_target_sets_chk"
    check ((("target_sets" is null) or ("target_sets" > 0))),
  constraint "workout_template_exercises_target_weight_chk"
    check ((("target_weight_kg" is null) or ("target_weight_kg" >= (0)::numeric))),
  constraint "workout_template_exercises_base_weight_chk"
    check ((("base_weight_kg" is null) or ("base_weight_kg" >= (0)::numeric))),
  constraint "workout_template_exercises_template_position_uniq"
    unique ("template_id", "position"),
  constraint "workout_template_exercises_template_id_fkey"
    foreign key ("template_id") references "public"."workout_templates"("id") on delete cascade,
  constraint "workout_template_exercises_exercise_id_fkey"
    foreign key ("exercise_id") references "public"."exercises"("id") on delete restrict
);

create index "idx_workout_template_exercises_template_position"
  on "public"."workout_template_exercises" using btree ("template_id", "position");

alter table "public"."workout_templates" enable row level security;

create policy "workout_templates_owner_all"
on "public"."workout_templates"
to "authenticated"
using (("user_id" = "auth"."uid"()))
with check (("user_id" = "auth"."uid"()));

alter table "public"."workout_template_exercises" enable row level security;

create policy "workout_template_exercises_owner_all"
on "public"."workout_template_exercises"
to "authenticated"
using (
  (exists (
    select 1
    from "public"."workout_templates" "wt"
    where (("wt"."id" = "workout_template_exercises"."template_id") and ("wt"."user_id" = "auth"."uid"()))
  ))
)
with check (
  (exists (
    select 1
    from "public"."workout_templates" "wt"
    where (("wt"."id" = "workout_template_exercises"."template_id") and ("wt"."user_id" = "auth"."uid"()))
  ))
);

grant all on table "public"."workout_templates" to "anon";
grant all on table "public"."workout_templates" to "authenticated";
grant all on table "public"."workout_templates" to "service_role";

grant all on table "public"."workout_template_exercises" to "anon";
grant all on table "public"."workout_template_exercises" to "authenticated";
grant all on table "public"."workout_template_exercises" to "service_role";
