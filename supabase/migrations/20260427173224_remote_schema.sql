


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."language_code" AS ENUM (
    'en',
    'de'
);


ALTER TYPE "public"."language_code" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.app_users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "preferred_lang_code" "public"."language_code" DEFAULT 'en'::"public"."language_code" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_translations" (
    "exercise_id" "uuid" NOT NULL,
    "lang_code" "public"."language_code" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercise_translations_name_nonempty_chk" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."exercise_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercises_slug_format_chk" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_session_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "target_sets" integer,
    "target_reps" integer,
    "target_weight_kg" numeric(6,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workout_session_exercises_position_chk" CHECK (("position" > 0)),
    CONSTRAINT "workout_session_exercises_target_reps_chk" CHECK ((("target_reps" IS NULL) OR ("target_reps" > 0))),
    CONSTRAINT "workout_session_exercises_target_sets_chk" CHECK ((("target_sets" IS NULL) OR ("target_sets" > 0))),
    CONSTRAINT "workout_session_exercises_target_weight_chk" CHECK ((("target_weight_kg" IS NULL) OR ("target_weight_kg" >= (0)::numeric)))
);


ALTER TABLE "public"."workout_session_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "performed_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workout_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_exercise_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "reps" integer NOT NULL,
    "weight_kg" numeric(6,2),
    "is_warmup" boolean DEFAULT false NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workout_sets_reps_chk" CHECK (("reps" > 0)),
    CONSTRAINT "workout_sets_set_number_chk" CHECK (("set_number" > 0)),
    CONSTRAINT "workout_sets_weight_chk" CHECK ((("weight_kg" IS NULL) OR ("weight_kg" >= (0)::numeric)))
);


ALTER TABLE "public"."workout_sets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_translations"
    ADD CONSTRAINT "exercise_translations_pkey" PRIMARY KEY ("exercise_id", "lang_code");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."workout_session_exercises"
    ADD CONSTRAINT "workout_session_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_session_exercises"
    ADD CONSTRAINT "workout_session_exercises_session_position_uniq" UNIQUE ("session_id", "position");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_sets"
    ADD CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_sets"
    ADD CONSTRAINT "workout_sets_unique_per_exercise" UNIQUE ("session_exercise_id", "set_number");



CREATE INDEX "idx_exercise_translations_lang_code" ON "public"."exercise_translations" USING "btree" ("lang_code");



CREATE INDEX "idx_workout_session_exercises_exercise" ON "public"."workout_session_exercises" USING "btree" ("exercise_id");



CREATE INDEX "idx_workout_session_exercises_session" ON "public"."workout_session_exercises" USING "btree" ("session_id");



CREATE INDEX "idx_workout_sessions_user_date" ON "public"."workout_sessions" USING "btree" ("user_id", "performed_on" DESC);



CREATE INDEX "idx_workout_sets_performed_at" ON "public"."workout_sets" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_workout_sets_session_exercise" ON "public"."workout_sets" USING "btree" ("session_exercise_id");



CREATE OR REPLACE TRIGGER "trg_app_users_set_updated_at" BEFORE UPDATE ON "public"."app_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exercises_set_updated_at" BEFORE UPDATE ON "public"."exercises" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_workout_sessions_set_updated_at" BEFORE UPDATE ON "public"."workout_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_translations"
    ADD CONSTRAINT "exercise_translations_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_session_exercises"
    ADD CONSTRAINT "workout_session_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."workout_session_exercises"
    ADD CONSTRAINT "workout_session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sets"
    ADD CONSTRAINT "workout_sets_session_exercise_id_fkey" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."workout_session_exercises"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_users_insert_own" ON "public"."app_users" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "app_users_select_own" ON "public"."app_users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "app_users_update_own" ON "public"."app_users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."exercise_translations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_translations_read_authenticated" ON "public"."exercise_translations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercises_read_authenticated" ON "public"."exercises" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."workout_session_exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workout_session_exercises_owner_all" ON "public"."workout_session_exercises" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workout_sessions" "ws"
  WHERE (("ws"."id" = "workout_session_exercises"."session_id") AND ("ws"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workout_sessions" "ws"
  WHERE (("ws"."id" = "workout_session_exercises"."session_id") AND ("ws"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."workout_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workout_sessions_owner_all" ON "public"."workout_sessions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."workout_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workout_sets_owner_all" ON "public"."workout_sets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."workout_session_exercises" "wse"
     JOIN "public"."workout_sessions" "ws" ON (("ws"."id" = "wse"."session_id")))
  WHERE (("wse"."id" = "workout_sets"."session_exercise_id") AND ("ws"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."workout_session_exercises" "wse"
     JOIN "public"."workout_sessions" "ws" ON (("ws"."id" = "wse"."session_id")))
  WHERE (("wse"."id" = "workout_sets"."session_exercise_id") AND ("ws"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_translations" TO "anon";
GRANT ALL ON TABLE "public"."exercise_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_translations" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."workout_session_exercises" TO "anon";
GRANT ALL ON TABLE "public"."workout_session_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_session_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."workout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sets" TO "anon";
GRANT ALL ON TABLE "public"."workout_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sets" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


