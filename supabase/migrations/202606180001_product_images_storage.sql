insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and name like 'uploads/%'
);

create policy "Product images are publicly readable"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');
