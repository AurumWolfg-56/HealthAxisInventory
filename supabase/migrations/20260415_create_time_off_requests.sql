-- Crear tabla 'time_off_requests' para el módulo Smart Scheduler 2.0
create table public.time_off_requests (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    start_date date not null,
    end_date date not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    reason text,
    reviewed_by uuid references public.users(id) on delete set null,
    location_id uuid references public.locations(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Configurar Row Level Security (RLS)
alter table public.time_off_requests enable row level security;

-- Políticas
create policy "Anyone can read time off requests"
on public.time_off_requests for select
to authenticated
using (true);

create policy "Auth users can insert time off requests"
on public.time_off_requests for insert
to authenticated
with check (true);

create policy "Auth users can update time off requests"
on public.time_off_requests for update
to authenticated
using (true);

create policy "Auth users can delete their own requests"
on public.time_off_requests for delete
to authenticated
using (true);
