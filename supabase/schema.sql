create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum ('user', 'admin');
create type public.project_status as enum ('draft', 'active', 'archived');
create type public.image_status as enum ('queued', 'processing', 'completed', 'failed', 'deleted');
create type public.template_visibility as enum ('public', 'private', 'unlisted');
create type public.credit_transaction_type as enum ('grant', 'spend', 'refund', 'expire', 'adjustment');
create type public.payment_provider as enum ('stripe', 'paypal', 'manual', 'alipay');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'canceled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.users(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text,
  visibility public.template_visibility not null default 'private',
  category text,
  prompt_schema jsonb not null default '{}'::jsonb,
  default_settings jsonb not null default '{}'::jsonb,
  credit_cost integer not null default 1 check (credit_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  name text not null,
  description text,
  status public.project_status not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (length(btrim(name)) > 0)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider public.payment_provider not null default 'stripe',
  provider_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  plan_code text not null,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  currency char(3) not null default 'USD',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_identifier_unique unique (provider, provider_subscription_id),
  constraint subscriptions_currency_uppercase check (currency = upper(currency))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider public.payment_provider not null default 'alipay',
  provider_payment_id text,
  status public.payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  credits_purchased integer not null default 0 check (credits_purchased >= 0),
  idempotency_key text,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_identifier_unique unique (provider, provider_payment_id),
  constraint payments_idempotency_key_unique unique (idempotency_key),
  constraint payments_currency_uppercase check (currency = upper(currency))
);

create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  prompt text not null,
  negative_prompt text,
  model text not null,
  storage_bucket text not null default 'generated-images',
  storage_path text,
  status public.image_status not null default 'queued',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  seed bigint,
  credits_spent integer not null default 0 check (credits_spent >= 0),
  error_message text,
  generation_params jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_images_prompt_not_blank check (length(btrim(prompt)) > 0),
  constraint generated_images_storage_path_when_completed check (
    status <> 'completed' or storage_path is not null
  )
);

create table public.product_recognitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  image_url text not null,
  model text not null,
  product_name text not null default '',
  category text not null default '',
  target_user text not null default '',
  highlights jsonb not null default '[]'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_recognitions_highlights_array check (jsonb_typeof(highlights) = 'array'),
  constraint product_recognitions_image_url_not_blank check (length(btrim(image_url)) > 0)
);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  generated_image_id uuid references public.generated_images(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  transaction_type public.credit_transaction_type not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credits_idempotency_key_unique unique (idempotency_key),
  constraint credits_amount_matches_type check (
    (transaction_type in ('grant', 'refund', 'adjustment') and amount > 0)
    or (transaction_type in ('spend', 'expire') and amount < 0)
  )
);

create index users_email_idx on public.users (email);
create index templates_active_public_idx on public.templates (is_active, visibility) where is_active = true;
create index templates_creator_id_idx on public.templates (creator_id);
create index projects_user_id_created_at_idx on public.projects (user_id, created_at desc);
create index projects_template_id_idx on public.projects (template_id);
create index subscriptions_user_id_status_idx on public.subscriptions (user_id, status);
create index payments_user_id_created_at_idx on public.payments (user_id, created_at desc);
create index payments_subscription_id_idx on public.payments (subscription_id);
create index generated_images_user_id_created_at_idx on public.generated_images (user_id, created_at desc);
create index generated_images_project_id_created_at_idx on public.generated_images (project_id, created_at desc);
create index generated_images_template_id_idx on public.generated_images (template_id);
create index product_recognitions_user_id_created_at_idx on public.product_recognitions (user_id, created_at desc);
create index credits_user_id_created_at_idx on public.credits (user_id, created_at desc);
create index credits_payment_id_idx on public.credits (payment_id);
create index credits_generated_image_id_idx on public.credits (generated_image_id);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_generated_images_updated_at
before update on public.generated_images
for each row execute function public.set_updated_at();

create trigger set_product_recognitions_updated_at
before update on public.product_recognitions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name),
    avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.templates enable row level security;
alter table public.projects enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.generated_images enable row level security;
alter table public.product_recognitions enable row level security;
alter table public.credits enable row level security;

create policy "Users can view own profile"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Public active templates are readable"
on public.templates for select
to anon, authenticated
using (is_active = true and visibility = 'public');

create policy "Users can read own templates"
on public.templates for select
to authenticated
using (creator_id = auth.uid());

create policy "Users can create own templates"
on public.templates for insert
to authenticated
with check (creator_id = auth.uid());

create policy "Users can update own templates"
on public.templates for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "Users can read own projects"
on public.projects for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own projects"
on public.projects for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    template_id is null
    or exists (
      select 1
      from public.templates
      where templates.id = projects.template_id
        and templates.is_active = true
        and (
          templates.visibility = 'public'
          or templates.creator_id = auth.uid()
        )
    )
  )
);

create policy "Users can update own projects"
on public.projects for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    template_id is null
    or exists (
      select 1
      from public.templates
      where templates.id = projects.template_id
        and templates.is_active = true
        and (
          templates.visibility = 'public'
          or templates.creator_id = auth.uid()
        )
    )
  )
);

create policy "Users can read own subscriptions"
on public.subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "Users can read own payments"
on public.payments for select
to authenticated
using (user_id = auth.uid());

create policy "Users can read own images"
on public.generated_images for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own images"
on public.generated_images for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = generated_images.project_id
      and projects.user_id = auth.uid()
  )
  and (
    template_id is null
    or exists (
      select 1
      from public.templates
      where templates.id = generated_images.template_id
        and templates.is_active = true
        and (
          templates.visibility = 'public'
          or templates.creator_id = auth.uid()
        )
    )
  )
);

create policy "Users can update own images"
on public.generated_images for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = generated_images.project_id
      and projects.user_id = auth.uid()
  )
  and (
    template_id is null
    or exists (
      select 1
      from public.templates
      where templates.id = generated_images.template_id
        and templates.is_active = true
        and (
          templates.visibility = 'public'
          or templates.creator_id = auth.uid()
        )
    )
  )
);

create policy "Users can read own product recognitions"
on public.product_recognitions for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own product recognitions"
on public.product_recognitions for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can read own credits"
on public.credits for select
to authenticated
using (user_id = auth.uid());

create view public.user_credit_balances
with (security_invoker = true)
as
select distinct on (user_id)
  user_id,
  balance_after,
  created_at as calculated_at
from public.credits
order by user_id, created_at desc, id desc;

create or replace function public.spend_image_generation_credits(
  p_user_id uuid,
  p_project_id uuid,
  p_generated_image_id uuid,
  p_amount integer,
  p_image_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer := 0;
  next_balance integer;
  existing_balance integer;
  spend_key text := 'spend:image-generation:' || p_generated_image_id::text;
begin
  if auth.uid() <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_amount <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if not exists (
    select 1
    from public.generated_images
    where id = p_generated_image_id
      and user_id = p_user_id
      and project_id = p_project_id
      and status <> 'deleted'
  ) then
    raise exception 'IMAGE_JOB_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select balance_after
  into existing_balance
  from public.credits
  where idempotency_key = spend_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);

  if current_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  next_balance := current_balance - p_amount;

  insert into public.credits (
    user_id,
    project_id,
    generated_image_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_project_id,
    p_generated_image_id,
    'spend',
    -p_amount,
    next_balance,
    spend_key,
    jsonb_build_object('image_type', p_image_type)
  );

  update public.generated_images
  set credits_spent = p_amount
  where id = p_generated_image_id
    and user_id = p_user_id;

  return next_balance;
end;
$$;

create or replace function public.refund_image_generation_credits(
  p_user_id uuid,
  p_project_id uuid,
  p_generated_image_id uuid,
  p_amount integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer := 0;
  next_balance integer;
  existing_balance integer;
  refund_key text := 'refund:image-generation:' || p_generated_image_id::text;
begin
  if auth.uid() <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_amount <= 0 then
    select balance_after
    into current_balance
    from public.credits
    where user_id = p_user_id
    order by created_at desc, id desc
    limit 1;

    return coalesce(current_balance, 0);
  end if;

  if not exists (
    select 1
    from public.generated_images
    where id = p_generated_image_id
      and user_id = p_user_id
      and project_id = p_project_id
  ) then
    raise exception 'IMAGE_JOB_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select balance_after
  into existing_balance
  from public.credits
  where idempotency_key = refund_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);
  next_balance := current_balance + p_amount;

  insert into public.credits (
    user_id,
    project_id,
    generated_image_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_project_id,
    p_generated_image_id,
    'refund',
    p_amount,
    next_balance,
    refund_key,
    jsonb_build_object('reason', p_reason)
  );

  update public.generated_images
  set credits_spent = 0
  where id = p_generated_image_id
    and user_id = p_user_id;

  return next_balance;
end;
$$;

create or replace function public.grant_payment_credits(
  p_user_id uuid,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text,
  p_credits integer,
  p_idempotency_key text,
  p_provider_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer := 0;
  existing_balance integer;
  next_balance integer;
  payment_record_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if p_provider_payment_id is null or length(btrim(p_provider_payment_id)) = 0 then
    raise exception 'PROVIDER_PAYMENT_ID_REQUIRED';
  end if;

  if p_amount_cents < 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  if p_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  insert into public.payments (
    user_id,
    provider,
    provider_payment_id,
    status,
    amount_cents,
    currency,
    credits_purchased,
    idempotency_key,
    provider_payload,
    paid_at
  )
  values (
    p_user_id,
    'alipay',
    p_provider_payment_id,
    'succeeded',
    p_amount_cents,
    upper(p_currency)::char(3),
    p_credits,
    p_idempotency_key,
    coalesce(p_provider_payload, '{}'::jsonb),
    now()
  )
  on conflict (provider, provider_payment_id) do update
  set
    status = 'succeeded',
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    credits_purchased = excluded.credits_purchased,
    idempotency_key = excluded.idempotency_key,
    provider_payload = excluded.provider_payload,
    paid_at = coalesce(public.payments.paid_at, excluded.paid_at),
    updated_at = now()
  returning id into payment_record_id;

  select balance_after
  into existing_balance
  from public.credits
  where idempotency_key = p_idempotency_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);
  next_balance := current_balance + p_credits;

  insert into public.credits (
    user_id,
    payment_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    payment_record_id,
    'grant',
    p_credits,
    next_balance,
    p_idempotency_key,
    jsonb_build_object('provider', 'alipay', 'provider_payment_id', p_provider_payment_id)
  );

  return next_balance;
end;
$$;

revoke update on public.users from anon, authenticated;
grant update (full_name, avatar_url) on public.users to authenticated;

revoke insert, update, delete on public.credits from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

revoke all on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) from public;

grant execute on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) to service_role;
