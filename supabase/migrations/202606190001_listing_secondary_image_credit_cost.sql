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

  if p_image_type = 'main_image' and p_amount <> 2 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if p_image_type in ('lifestyle', 'infographic') and p_amount <> 2 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if p_image_type in ('detail_page_module', 'detail_page_long') and p_amount <> 3 then
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

revoke all on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.spend_image_generation_credits(uuid, uuid, uuid, integer, text) to authenticated;
