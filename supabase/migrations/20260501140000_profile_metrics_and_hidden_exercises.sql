create table if not exists "public"."user_profile_metrics" (
  "user_id" uuid not null,
  "bodyweight_kg" numeric(6,2),
  "height_cm" numeric(6,2),
  "birth_year" smallint,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "user_profile_metrics_pkey" primary key ("user_id"),
  constraint "user_profile_metrics_bodyweight_kg_chk"
    check (("bodyweight_kg" is null) or (("bodyweight_kg" >= (20)::numeric) and ("bodyweight_kg" <= (400)::numeric))),
  constraint "user_profile_metrics_height_cm_chk"
    check (("height_cm" is null) or (("height_cm" >= (100)::numeric) and ("height_cm" <= (250)::numeric))),
  constraint "user_profile_metrics_birth_year_chk"
    check (
      ("birth_year" is null)
      or (
        ("birth_year" >= 1900)
        and ("birth_year" <= (extract(year from (current_date))::integer))
      )
    )
);

alter table "public"."user_profile_metrics"
  add constraint "user_profile_metrics_user_id_fkey"
  foreign key ("user_id") references "public"."app_users"("id") on delete cascade;

create trigger "trg_user_profile_metrics_set_updated_at"
before update on "public"."user_profile_metrics"
for each row execute function "public"."set_updated_at"();

alter table "public"."user_profile_metrics" enable row level security;

create policy "user_profile_metrics_owner_all"
on "public"."user_profile_metrics"
to "authenticated"
using (("user_id" = "auth"."uid"()))
with check (("user_id" = "auth"."uid"()));

create table if not exists "public"."user_hidden_exercises" (
  "user_id" uuid not null,
  "exercise_id" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  constraint "user_hidden_exercises_pkey" primary key ("user_id", "exercise_id")
);

alter table "public"."user_hidden_exercises"
  add constraint "user_hidden_exercises_user_id_fkey"
  foreign key ("user_id") references "public"."app_users"("id") on delete cascade;

alter table "public"."user_hidden_exercises"
  add constraint "user_hidden_exercises_exercise_id_fkey"
  foreign key ("exercise_id") references "public"."exercises"("id") on delete cascade;

create index "idx_user_hidden_exercises_user"
  on "public"."user_hidden_exercises" using btree ("user_id");

alter table "public"."user_hidden_exercises" enable row level security;

create policy "user_hidden_exercises_owner_all"
on "public"."user_hidden_exercises"
to "authenticated"
using (("user_id" = "auth"."uid"()))
with check (("user_id" = "auth"."uid"()));

grant all on table "public"."user_hidden_exercises" to "anon";
grant all on table "public"."user_hidden_exercises" to "authenticated";
grant all on table "public"."user_hidden_exercises" to "service_role";

grant all on table "public"."user_profile_metrics" to "anon";
grant all on table "public"."user_profile_metrics" to "authenticated";
grant all on table "public"."user_profile_metrics" to "service_role";
