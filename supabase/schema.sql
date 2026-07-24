-- AHIVOYAPP · Esquema de base de datos para Supabase
-- Pega TODO este archivo en: Supabase → SQL Editor → New query → Run

-- ============ TABLAS ============

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text default '',
  foto text,                        -- foto de perfil (data URL pequeña)
  edad int default 25,
  altura int default 170,           -- cm
  peso numeric default 180,          -- lb
  meta_peso numeric default 165,     -- lb
  meta_kcal int default 2000,
  meta_proteina int default 115,
  meta_carbos int default 220,
  meta_grasa int default 70,
  meta_agua int default 3000,        -- ml
  creado timestamptz default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  tiempo text not null check (tiempo in ('Desayuno','Almuerzo','Cena','Snack')),
  descripcion text not null default '',
  kcal int not null default 0,
  proteina int not null default 0,
  carbos int not null default 0,
  grasa int not null default 0,
  foto_url text,
  creado timestamptz default now()
);
create index if not exists meals_user_fecha on public.meals (user_id, fecha);

-- OBSOLETA (dejada por compatibilidad, ya no la usa la app): guardaba un
-- solo total de agua por día, sin forma de corregir un valor erróneo.
-- Reemplazada por "drinks" (un registro por cada vaso/bebida, como "meals").
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  ml int not null default 0,
  unique (user_id, fecha)
);

create table if not exists public.drinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  ml int not null default 0,        -- puede ser negativo (ajuste/resta)
  nombre text not null default 'Agua', -- "Agua", "Café", "Jugo", "Ajuste"...
  creado timestamptz default now()
);
create index if not exists drinks_user_fecha on public.drinks (user_id, fecha);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  peso_lb numeric not null,
  unique (user_id, fecha)
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  minutos int not null default 0,
  fases jsonb,                       -- {deep, light, rem, awake} en %
  unique (user_id, fecha)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  dia text not null default 'Push' check (dia in ('Push','Pull','Legs')),
  completado boolean not null default false,
  kcal_quemadas int not null default 0,
  nombre text default '',
  notas text default '',
  unique (user_id, fecha)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  pasos int not null default 0,
  min_activos int not null default 0,
  kcal_activas int not null default 0,
  kcal_totales int not null default 0,
  distancia_km numeric not null default 0,
  unique (user_id, fecha)
);

create table if not exists public.body_composition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  score int,
  complexion text,
  imc numeric,
  grasa_pct numeric,
  agua_pct numeric,
  proteina_pct numeric,
  bmr int,
  grasa_visceral numeric,
  musculo_lb numeric,
  masa_osea_lb numeric,
  creado timestamptz default now()
);
create index if not exists bodycomp_user_fecha on public.body_composition (user_id, fecha desc);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dia text not null check (dia in ('Push','Pull','Legs')),
  ejercicios jsonb not null default '[]',   -- [{name, sets}]
  unique (user_id, dia)
);

-- Por si la tabla ya existía sin estas columnas:
alter table public.profiles add column if not exists foto text;
alter table public.profiles add column if not exists sexo text default 'M';
alter table public.profiles add column if not exists nivel_actividad text default 'ligero';

-- ============ CONTROL DE ACCESO (aprobación manual + panel admin) ============
-- Las cuentas YA existentes quedan aprobadas y con el asistente de bienvenida
-- ya hecho (se agregan con ese valor por defecto y LUEGO se cambia el default
-- para las cuentas nuevas) — así nadie que ya usa la app se queda bloqueado.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists status text default 'approved';
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists onboarded boolean not null default true;
update public.profiles set status = 'approved' where status is null;
alter table public.profiles alter column status set default 'pending';
alter table public.profiles alter column onboarded set default false;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('pending','approved','rejected'));

-- Protege status/is_admin: solo un admin puede cambiarlos desde la APP (ni
-- siquiera el propio dueño de la fila, aunque la API de Supabase
-- técnicamente se lo permitiría por RLS de fila). auth.uid() es NULL
-- cuando la consulta NO viene de una sesión de la app (ej. el SQL Editor
-- del dashboard) — ahí sí se permite, porque solo alguien con acceso al
-- dashboard del proyecto llega hasta ese punto.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := old.status;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

-- ============ ROW LEVEL SECURITY ============
-- Cada usuario SOLO puede ver y tocar sus propios datos.

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.water_logs enable row level security;
alter table public.drinks enable row level security;
alter table public.weight_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.activity_logs enable row level security;
alter table public.body_composition enable row level security;
alter table public.routines enable row level security;

-- profiles usa id = auth.uid()
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Un admin puede ver/editar CUALQUIER perfil (para aprobar/rechazar
-- usuarios). Una política que consulta la MISMA tabla que protege puede
-- causar "infinite recursion detected in policy" en Postgres — por eso el
-- chequeo vive en una función security definer, que se salta el RLS al
-- resolver ESE lookup puntual (no al resto de la consulta).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- el resto usa user_id = auth.uid()
do $$
declare t text;
begin
  foreach t in array array['meals','water_logs','drinks','weight_logs','sleep_logs','workouts','activity_logs','body_composition','routines']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t
    );
  end loop;
end $$;

-- ============ PERFIL AUTOMÁTICO AL REGISTRARSE ============
-- Nuevas cuentas quedan "pending" (esperando tu aprobación) salvo la tuya,
-- que se auto-aprueba y se vuelve administradora.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  es_admin boolean := lower(new.email) = 'primepacksv@gmail.com';
begin
  insert into public.profiles (id, nombre, email, status, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    new.email,
    case when es_admin then 'approved' else 'pending' end,
    es_admin
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Si tu cuenta ya existía antes de este cambio, la promueve a admin ahora
-- (el trigger de arriba solo corre en registros NUEVOS).
update public.profiles p
set status = 'approved', is_admin = true, onboarded = true
from auth.users u
where p.id = u.id and lower(u.email) = 'primepacksv@gmail.com';
