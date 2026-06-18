# Supabase Database Design

## ER Diagram

```mermaid
erDiagram
  users ||--o{ projects : owns
  users ||--o{ generated_images : creates
  users ||--o{ product_recognitions : uploads
  users ||--o{ templates : creates
  users ||--o{ credits : has
  users ||--o{ payments : makes
  users ||--o{ subscriptions : subscribes

  templates ||--o{ projects : starts_from
  templates ||--o{ generated_images : used_by

  projects ||--o{ generated_images : contains
  projects ||--o{ credits : consumes

  generated_images ||--o{ credits : consumes

  subscriptions ||--o{ payments : bills
  payments ||--o{ credits : grants

  users {
    uuid id PK
    text email
    text full_name
    text avatar_url
    user_role role
    jsonb metadata
    timestamptz created_at
    timestamptz updated_at
  }

  projects {
    uuid id PK
    uuid user_id FK
    uuid template_id FK
    text name
    text description
    project_status status
    jsonb settings
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }

  generated_images {
    uuid id PK
    uuid user_id FK
    uuid project_id FK
    uuid template_id FK
    text prompt
    text negative_prompt
    text model
    text storage_bucket
    text storage_path
    image_status status
    integer width
    integer height
    integer credits_spent
    jsonb generation_params
    jsonb metadata
    timestamptz created_at
    timestamptz updated_at
  }

  product_recognitions {
    uuid id PK
    uuid user_id FK
    text image_url
    text model
    text product_name
    text category
    text target_user
    jsonb highlights
    jsonb raw_response
    timestamptz created_at
    timestamptz updated_at
  }

  templates {
    uuid id PK
    uuid creator_id FK
    text slug
    text name
    text description
    template_visibility visibility
    text category
    jsonb prompt_schema
    jsonb default_settings
    integer credit_cost
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  credits {
    uuid id PK
    uuid user_id FK
    uuid project_id FK
    uuid generated_image_id FK
    uuid payment_id FK
    credit_transaction_type transaction_type
    integer amount
    integer balance_after
    text idempotency_key
    jsonb metadata
    timestamptz created_at
  }

  payments {
    uuid id PK
    uuid user_id FK
    uuid subscription_id FK
    payment_provider provider
    text provider_payment_id
    payment_status status
    integer amount_cents
    char currency
    integer credits_purchased
    jsonb provider_payload
    timestamptz paid_at
    timestamptz created_at
    timestamptz updated_at
  }

  subscriptions {
    uuid id PK
    uuid user_id FK
    payment_provider provider
    text provider_subscription_id
    subscription_status status
    text plan_code
    integer unit_amount_cents
    char currency
    timestamptz current_period_start
    timestamptz current_period_end
    timestamptz cancel_at
    timestamptz canceled_at
    timestamptz created_at
    timestamptz updated_at
  }
```

## Production Notes

- `public.users.id` references `auth.users.id` so Supabase Auth remains the identity source of truth.
- Row Level Security is enabled on all application tables.
- `credits` is an immutable-style ledger table with positive grant/refund rows and negative spend/expiration rows. Store the current balance in `balance_after` for auditability; calculate the latest balance from the newest row when needed.
- External payment identifiers use unique indexes scoped by provider to make webhook handling idempotent.
- `idempotency_key` fields are available for payment and credit grant/spend operations.
- Large images should live in Supabase Storage; `generated_images` stores bucket/path and metadata only.
- Uploaded product images are analyzed into `product_recognitions`, storing the product name, category, target user, highlights, and raw OpenAI response for auditability.
- Soft deletion is represented with `archived_at` on projects and status columns on images, payments, and subscriptions.
