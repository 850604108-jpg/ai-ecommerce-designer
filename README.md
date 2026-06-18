# AI Ecommerce Designer

AI Ecommerce Designer is a production-ready Next.js app for ecommerce creative workflows. It lets users upload a product photo, recognize product details with OpenAI, generate marketplace-specific prompts, create AI product images, manage generated image history, and buy credits through Stripe.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres, and Storage
- Stripe Checkout and webhooks
- OpenAI Responses and Images APIs
- Vercel deployment target

## Features

- User registration, login, password reset, and session-aware navigation.
- Product image upload to Supabase Storage.
- AI product recognition from uploaded images.
- Prompt generation for Taobao, Tmall, Pinduoduo, JD, Douyin, Kuaishou, and WeChat Store.
- AI generation for main images, lifestyle images, infographics, and detail page modules.
- Credit ledger with spend, refund, and payment grant records.
- Stripe credit-pack checkout and webhook processing.
- Dashboard with generated image history, search, pagination, copy, regenerate, and soft delete.
- Admin dashboard for users, projects, payments, credits, and templates.
- Template marketplace and admin template management.
- Production health check endpoint.

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in Supabase, Stripe, OpenAI, and app URL values in `.env.local`.

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

See [.env.example](./.env.example) for the complete list.

Required for production:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_GROWTH_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `OPENAI_API_KEY`

Recommended:

- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_VISION_MODEL`
- `HEALTHCHECK_TOKEN`

## Database

Apply migrations from [supabase/migrations](./supabase/migrations) in order. The database design is documented in [docs/database-design.md](./docs/database-design.md).

Required storage buckets:

- `product-images` or the bucket named by `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `generated-images`

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run typecheck
npm run check:deployment
```

`npm run check:deployment` validates the shape and presence of production environment variables.

## Deployment

Deploy to Vercel with the default Next.js settings. Full production deployment steps are in [docs/deployment.md](./docs/deployment.md).

After deployment, check:

```bash
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://your-domain.com/api/health/deployment
```

The endpoint returns safe pass/fail deployment checks and verifies the database connection when server credentials are configured.
