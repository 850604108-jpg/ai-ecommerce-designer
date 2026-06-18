create or replace view public.credits_log
with (security_invoker = true)
as
select
  id,
  user_id,
  project_id,
  generated_image_id,
  payment_id,
  transaction_type,
  amount,
  balance_after,
  idempotency_key,
  metadata,
  created_at
from public.credits;

grant select on public.credits_log to authenticated;
revoke insert, update, delete on public.credits_log from anon, authenticated;

create or replace view public.user_credit_balances
with (security_invoker = true)
as
select distinct on (user_id)
  user_id,
  balance_after,
  created_at as calculated_at
from public.credits_log
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

  if p_image_type = 'main_image' and p_amount <> 1 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if p_image_type in ('lifestyle', 'infographic') and p_amount <> 2 then
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
  from public.credits_log
  where idempotency_key = spend_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits_log
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);

  if current_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  next_balance := current_balance - p_amount;

  insert into public.credits_log (
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
    from public.credits_log
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
  from public.credits_log
  where idempotency_key = refund_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits_log
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);
  next_balance := current_balance + p_amount;

  insert into public.credits_log (
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
    'stripe',
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
  from public.credits_log
  where idempotency_key = p_idempotency_key;

  if existing_balance is not null then
    return existing_balance;
  end if;

  select balance_after
  into current_balance
  from public.credits_log
  where user_id = p_user_id
  order by created_at desc, id desc
  limit 1;

  current_balance := coalesce(current_balance, 0);
  next_balance := current_balance + p_credits;

  insert into public.credits_log (
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
    jsonb_build_object('provider', 'stripe', 'provider_payment_id', p_provider_payment_id)
  );

  return next_balance;
end;
$$;

revoke all on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) from public;

grant execute on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) to service_role;
