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

create index product_recognitions_user_id_created_at_idx
on public.product_recognitions (user_id, created_at desc);

create trigger set_product_recognitions_updated_at
before update on public.product_recognitions
for each row execute function public.set_updated_at();

alter table public.product_recognitions enable row level security;

create policy "Users can read own product recognitions"
on public.product_recognitions for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own product recognitions"
on public.product_recognitions for insert
to authenticated
with check (user_id = auth.uid());
