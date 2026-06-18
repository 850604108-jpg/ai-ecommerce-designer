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

revoke all on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) from public;

grant execute on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.refund_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
