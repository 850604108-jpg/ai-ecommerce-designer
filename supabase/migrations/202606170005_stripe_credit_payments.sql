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
    jsonb_build_object('provider', 'stripe', 'provider_payment_id', p_provider_payment_id)
  );

  return next_balance;
end;
$$;

revoke all on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) from public;
grant execute on function public.grant_payment_credits(uuid, text, integer, text, integer, text, jsonb) to service_role;
