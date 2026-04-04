-- =============================================
-- Andijon Admin — Supabase Schema
-- =============================================

-- Drivers
create table if not exists drivers (
  id bigint primary key,
  name text not null,
  phone text,
  status text default 'regular' check (status in ('elite', 'regular')),
  rating decimal(3,2),
  created_at timestamptz default now()
);

-- Driver monthly metrics
create table if not exists driver_metrics (
  id uuid primary key default gen_random_uuid(),
  driver_id bigint references drivers(id) on delete cascade,
  month date not null,
  done_orders int default 0,
  reject_rate decimal(5,2),
  activity_score int,
  last_order_date date,
  created_at timestamptz default now(),
  unique(driver_id, month)
);

-- CC daily log
create table if not exists cc_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  cc_name text,
  total_incoming int default 0,
  client_calls int default 0,
  regular_driver_calls int default 0,
  elite_driver_calls int default 0,
  resolved_by_cc int default 0,
  escalated_to_rm int default 0,
  escalation_reasons text,
  outgoing_inactive int default 0,
  outgoing_inactive_responded int default 0,
  outgoing_onboarding int default 0,
  notes text,
  created_at timestamptz default now()
);

-- Escalations
create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  source text check (source in ('cc', 'rm')),
  driver_id bigint references drivers(id),
  caller_type text check (caller_type in ('elite', 'regular', 'client')),
  reason text not null,
  description text,
  status text default 'open' check (status in ('open', 'resolved', 'escalated')),
  resolved_by text,
  resolved_at timestamptz
);

-- Prices
create table if not exists prices (
  id uuid primary key default gen_random_uuid(),
  subregion text not null unique,
  is_center boolean default false,
  price_to_tashkent int not null,
  difference_from_center int default 0,
  last_updated timestamptz default now(),
  updated_by text
);

-- RM weekly reports
create table if not exists rm_reports (
  id uuid primary key default gen_random_uuid(),
  week_number int not null,
  week_start date not null,
  week_end date not null,
  rm_name text,
  cc_escalations_received int default 0,
  cc_escalations_resolved int default 0,
  cc_escalations_to_ops int default 0,
  done_orders int default 0,
  prev_done_orders int default 0,
  andijon_city_trips int default 0,
  active_drivers int default 0,
  elite_reject_rate decimal(5,2),
  general_reject_rate decimal(5,2),
  kval_drivers int default 0,
  nekval_drivers int default 0,
  elite_active int default 0,
  elite_total int default 50,
  elite_coverage decimal(5,2),
  elite_checkins_done int default 0,
  notes text,
  created_at timestamptz default now(),
  unique(week_start)
);

-- Elite driver calls tracking
create table if not exists elite_calls (
  id uuid primary key default gen_random_uuid(),
  driver_id bigint not null,
  called_at date not null default current_date,
  result text not null check (result in ('answered', 'no_answer', 'callback')),
  note text,
  called_by text,
  created_at timestamptz default now()
);
create index if not exists elite_calls_driver_id_idx on elite_calls(driver_id);

-- =============================================
-- Seed: Andijon subregion narxlari
-- =============================================
insert into prices (subregion, is_center, price_to_tashkent, difference_from_center) values
  ('Andijon', true, 250000, 0),
  ('Asaka', false, 265000, 15000),
  ('Baliqchi', false, 260000, 10000),
  ('Xonobod', false, 260000, 10000),
  ('Marhamat', false, 255000, 5000),
  ('Shahrixon', false, 275000, 25000),
  ('Qo''rg''ontepa', false, 280000, 30000),
  ('Jalolquduq', false, 270000, 20000),
  ('Bo''z', false, 258000, 8000),
  ('Oltinkol', false, 262000, 12000)
on conflict (subregion) do nothing;
