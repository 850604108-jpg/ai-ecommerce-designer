# Vercel Production Deployment

This app is ready for Vercel with Supabase, Stripe, and OpenAI configured through environment variables.

## 1. Required Environment Variables

Add these variables in Vercel Project Settings > Environment Variables for Production:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Production URL, for example `https://your-domain.com`. Must be HTTPS. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon public key. |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | No | Upload bucket for source product photos. Defaults to `product-images`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for admin dashboards and Stripe webhook credit grants. |
| `STRIPE_SECRET_KEY` | Yes | Use `sk_live_...` for production. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Use the Vercel production webhook endpoint signing secret. |
| `STRIPE_STARTER_PRICE_ID` | Yes | Stripe Price ID for the Starter credit pack. |
| `STRIPE_GROWTH_PRICE_ID` | Yes | Stripe Price ID for the Growth credit pack. |
| `STRIPE_PRO_PRICE_ID` | Yes | Stripe Price ID for the Pro credit pack. |
| `OPENAI_API_KEY` | Yes | OpenAI API key with image and vision model access. |
| `OPENAI_IMAGE_MODEL` | No | Defaults to `gpt-image-1`. |
| `OPENAI_VISION_MODEL` | No | Defaults to `gpt-5.5`. |
| `OPENAI_PROMPT_ENGINE_MODEL` | No | Defaults to `OPENAI_VISION_MODEL`, then `gpt-5.5`. |
| `OPENAI_PROMPT_ENGINE_ENABLED` | No | Set to `false` to use the deterministic local Prompt Engine only. Defaults to enabled. |
| `HEALTHCHECK_TOKEN` | Recommended | Protects `/api/health/deployment` with `Authorization: Bearer <token>`. |

Use [.env.example](../.env.example) as the source template. Do not commit real secrets.

## 2. Supabase Setup

1. Create a Supabase project.
2. Run migrations in order from [supabase/migrations](../supabase/migrations).
3. Create the public storage buckets:
   - `product-images` for uploaded product images, or match `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`.
   - `generated-images` for generated AI images.
4. Confirm RLS policies from the migrations are active.
5. In Supabase Auth URL Configuration, set:
   - Site URL: `NEXT_PUBLIC_APP_URL`
   - Redirect URLs: `NEXT_PUBLIC_APP_URL/auth/callback`

Database connection is checked at runtime by `/api/health/deployment` when Supabase server credentials are present.

## 3. Stripe Setup

1. Create three one-time payment Prices in Stripe for Starter, Growth, and Pro credit packs.
2. Copy their Price IDs into:
   - `STRIPE_STARTER_PRICE_ID`
   - `STRIPE_GROWTH_PRICE_ID`
   - `STRIPE_PRO_PRICE_ID`
3. Create a production webhook endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Use a live secret key in production.

The checkout route creates pending payment records. The webhook grants credits idempotently through `grant_payment_credits`.

## 4. OpenAI Setup

1. Set `OPENAI_API_KEY`.
2. Ensure the key can access the configured image model and vision model.
3. Optional model overrides:
   - `OPENAI_IMAGE_MODEL`
   - `OPENAI_VISION_MODEL`
   - `OPENAI_PROMPT_ENGINE_MODEL`
4. Optional: set `OPENAI_PROMPT_ENGINE_ENABLED=false` if you want prompt generation to skip OpenAI optimization and use only deterministic local templates.

Image generation stores files in the `generated-images` Supabase bucket and refunds credits if generation or upload fails.

## 5. Vercel Build Settings

Use Vercel defaults:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

Recommended pre-deploy checks:

```bash
npm run check:deployment
npm run lint
npm run build
npm run typecheck
```

`npm run check:deployment` validates required variables and common key prefixes. It does not call external services.

## 6. Production Health Check

After deployment:

```bash
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://your-domain.com/api/health/deployment
```

If `HEALTHCHECK_TOKEN` is not set, the endpoint is public but only returns safe pass/fail information.

Expected production response:

```json
{
  "ok": true,
  "checks": []
}
```

The real response includes individual checks and a `DATABASE_CONNECTION` result.

## 7. SEO And Performance

Implemented production SEO and performance basics:

- App-wide metadata, title template, canonical URL, Open Graph, and Twitter card metadata.
- `robots.txt` and `sitemap.xml` generated from `NEXT_PUBLIC_APP_URL`.
- Static asset cache headers for `/_next/static`.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- Next image remote pattern for Supabase public storage.
- `poweredByHeader` disabled.

Before launch, add real social preview images under `public/` and wire them into `metadata.openGraph.images` once final branding is available.

## 8. Final Launch Checklist

- Production environment variables are set in Vercel.
- Supabase migrations have been applied successfully.
- Supabase storage buckets exist and policies allow intended upload/read flows.
- Supabase Auth redirect URLs include the Vercel production URL.
- Stripe live prices are configured.
- Stripe production webhook points to `/api/stripe/webhook`.
- OpenAI key has access to the configured models.
- `npm run lint`, `npm run build`, and `npm run typecheck` pass.
- `/api/health/deployment` returns `ok: true`.
- A real user can register, upload a product image, generate prompts, buy credits, and generate images.
