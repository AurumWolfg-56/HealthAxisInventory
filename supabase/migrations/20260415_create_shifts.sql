-- Crear la tabla 'shifts' para el Smart Scheduler
create table public.shifts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date date not null,
    start_time text not null,
    end_time text not null,
    role_type text,
    notes text,
    location_id uuid references public.locations(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- Prevent exact duplicate shifts for the same person on the same date
    unique(user_id, date) 
);

-- Configurar Row Level Security (RLS)
alter table public.shifts enable row level security;

-- Política de Lectura (todos pueden ver el calendario de todos para poder cubrirse turnos)
create policy "Anyone can read shifts"
on public.shifts for select
to authenticated
using (true);

-- Política de Escritura (Sólo podrán insertar/modificar si su rol cuenta con los permisos en la app)
-- *Nota: HealthAxis maneja los roles por application level via user claims o JWT. 
-- *En caso de usar RLS estándar:
create policy "Auth users can manage shifts"
on public.shifts for insert
to authenticated
with check (true);

create policy "Auth users can update shifts"
on public.shifts for update
to authenticated
using (true);

create policy "Auth users can delete shifts"
on public.shifts for delete
to authenticated
using (true);
