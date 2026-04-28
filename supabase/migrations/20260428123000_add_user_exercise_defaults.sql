create table if not exists "public"."user_exercise_defaults" (
  "user_id" uuid not null,
  "exercise_id" uuid not null,
  "default_base_weight_kg" numeric(6,2),
  "default_target_sets" integer,
  "default_target_reps" integer,
  "default_target_weight_kg" numeric(6,2),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "user_exercise_defaults_pkey" primary key ("user_id", "exercise_id"),
  constraint "user_exercise_defaults_base_weight_chk" check (("default_base_weight_kg" is null) or ("default_base_weight_kg" >= (0)::numeric)),
  constraint "user_exercise_defaults_target_sets_chk" check (("default_target_sets" is null) or ("default_target_sets" > 0)),
  constraint "user_exercise_defaults_target_reps_chk" check (("default_target_reps" is null) or ("default_target_reps" > 0)),
  constraint "user_exercise_defaults_target_weight_chk" check (("default_target_weight_kg" is null) or ("default_target_weight_kg" >= (0)::numeric))
);

alter table "public"."user_exercise_defaults"
  add constraint "user_exercise_defaults_user_id_fkey"
  foreign key ("user_id") references "public"."app_users"("id") on delete cascade;

alter table "public"."user_exercise_defaults"
  add constraint "user_exercise_defaults_exercise_id_fkey"
  foreign key ("exercise_id") references "public"."exercises"("id") on delete cascade;

create index "idx_user_exercise_defaults_user"
  on "public"."user_exercise_defaults" using btree ("user_id");

create trigger "trg_user_exercise_defaults_set_updated_at"
before update on "public"."user_exercise_defaults"
for each row execute function "public"."set_updated_at"();

alter table "public"."user_exercise_defaults" enable row level security;

create policy "user_exercise_defaults_owner_all"
on "public"."user_exercise_defaults"
to "authenticated"
using (("user_id" = "auth"."uid"()))
with check (("user_id" = "auth"."uid"()));

grant all on table "public"."user_exercise_defaults" to "anon";
grant all on table "public"."user_exercise_defaults" to "authenticated";
grant all on table "public"."user_exercise_defaults" to "service_role";
