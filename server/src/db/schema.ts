/**
 * Database schema, as ordered migrations. Never edit a migration that has
 * shipped; add a new one instead. Statements are split on ";" at line ends.
 *
 * Money is stored as integer cents, so totals never pick up float rounding errors.
 */

export const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: '001_init',
    sql: `
create table users (
  id text primary key,
  phone text not null unique,
  phone_hash text not null,
  name text not null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_phone_hash_idx on users (phone_hash);

create table friendships (
  id text primary key,
  requester_id text not null references users (id) on delete cascade,
  addressee_id text not null references users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on friendships (addressee_id);

create table groups (
  id text primary key,
  name text not null,
  description text,
  created_by text not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table group_members (
  group_id text not null references groups (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on group_members (user_id);

create table receipts (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  source_type text not null,
  file_name text,
  mime_type text,
  parsed_data jsonb not null,
  ai_prompt text,
  expense_id text,
  created_at timestamptz not null default now()
);

create table expenses (
  id text primary key,
  group_id text references groups (id) on delete set null,
  title text not null,
  description text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  category text not null,
  paid_by text not null references users (id),
  split_type text not null,
  items jsonb,
  receipt_id text references receipts (id) on delete set null,
  date timestamptz not null,
  created_by text not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_group_idx on expenses (group_id);
create index expenses_paid_by_idx on expenses (paid_by);

create table expense_splits (
  expense_id text not null references expenses (id) on delete cascade,
  user_id text not null references users (id),
  amount_cents integer not null check (amount_cents >= 0),
  percentage numeric,
  paid boolean not null default false,
  primary key (expense_id, user_id)
);
create index expense_splits_user_idx on expense_splits (user_id);

create table settlements (
  id text primary key,
  from_user_id text not null references users (id),
  to_user_id text not null references users (id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  note text,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  group_id text references groups (id) on delete set null,
  expense_ids jsonb,
  initiated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index settlements_from_idx on settlements (from_user_id);
create index settlements_to_idx on settlements (to_user_id);

create table reminders (
  id text primary key,
  from_user_id text not null references users (id) on delete cascade,
  to_user_id text not null references users (id) on delete cascade,
  amount_cents integer,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);
create index reminders_to_idx on reminders (to_user_id, created_at);

create table billing_accounts (
  user_id text primary key references users (id) on delete cascade,
  stripe_customer_id text unique,
  subscription_id text,
  plan text not null default 'free',
  status text not null default 'none',
  billing_interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table ai_usage (
  user_id text not null references users (id) on delete cascade,
  month text not null,
  scans integer not null default 0,
  primary key (user_id, month)
);

create table processed_events (
  id text primary key,
  processed_at timestamptz not null default now()
);
`,
  },
];
