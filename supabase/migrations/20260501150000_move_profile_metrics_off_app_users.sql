do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profile_metrics'
  ) then
    create table public.user_profile_metrics (
      user_id uuid not null,
      bodyweight_kg numeric(6,2),
      height_cm numeric(6,2),
      birth_year smallint,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      constraint user_profile_metrics_pkey primary key (user_id),
      constraint user_profile_metrics_bodyweight_kg_chk
        check ((bodyweight_kg is null) or ((bodyweight_kg >= 20::numeric) and (bodyweight_kg <= 400::numeric))),
      constraint user_profile_metrics_height_cm_chk
        check ((height_cm is null) or ((height_cm >= 100::numeric) and (height_cm <= 250::numeric))),
      constraint user_profile_metrics_birth_year_chk
        check (
          (birth_year is null)
          or (
            (birth_year >= 1900)
            and (birth_year <= extract(year from current_date)::integer)
          )
        )
    );
  end if;
end
$$;

alter table public.user_profile_metrics
  drop constraint if exists user_profile_metrics_user_id_fkey;
alter table public.user_profile_metrics
  add constraint user_profile_metrics_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete cascade;

drop trigger if exists trg_user_profile_metrics_set_updated_at on public.user_profile_metrics;
create trigger trg_user_profile_metrics_set_updated_at
before update on public.user_profile_metrics
for each row execute function public.set_updated_at();

alter table public.user_profile_metrics enable row level security;

drop policy if exists user_profile_metrics_owner_all on public.user_profile_metrics;
create policy user_profile_metrics_owner_all
on public.user_profile_metrics
to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));

grant all on table public.user_profile_metrics to anon;
grant all on table public.user_profile_metrics to authenticated;
grant all on table public.user_profile_metrics to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'app_users' and column_name = 'bodyweight_kg'
  ) then
    execute $copy$
      insert into public.user_profile_metrics (user_id, bodyweight_kg, height_cm, birth_year)
      select id, bodyweight_kg, height_cm, birth_year
      from public.app_users
      where bodyweight_kg is not null
         or height_cm is not null
         or birth_year is not null
      on conflict (user_id) do update
      set bodyweight_kg = excluded.bodyweight_kg,
          height_cm = excluded.height_cm,
          birth_year = excluded.birth_year
    $copy$;
  end if;
end
$$;

alter table public.app_users
  drop constraint if exists app_users_bodyweight_kg_chk,
  drop constraint if exists app_users_height_cm_chk,
  drop constraint if exists app_users_birth_year_chk,
  drop column if exists bodyweight_kg,
  drop column if exists height_cm,
  drop column if exists birth_year;
