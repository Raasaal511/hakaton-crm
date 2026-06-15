-- Migration: CRM, Catalog and RBAC extension
-- Run order matters: enums first, then tables in FK dependency order

-- 1. Extend existing organization_role enum with new values
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. Create new org_role_v2 enum
DO $$ BEGIN
  CREATE TYPE org_role_v2 AS ENUM ('owner', 'admin', 'manager', 'employee', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. CRM Segments
CREATE TABLE IF NOT EXISTS crm_segments (
  id           serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         varchar(255) NOT NULL,
  description  text,
  color        varchar(7) DEFAULT '#4361ee',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_segments_org_idx ON crm_segments(organization_id);

-- 4. CRM Companies
CREATE TABLE IF NOT EXISTS crm_companies (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             varchar(255) NOT NULL,
  industry         varchar(100),
  website          varchar(512),
  email            varchar(150),
  phone            varchar(50),
  city             varchar(100),
  address          text,
  employees_count  integer,
  annual_revenue   integer,
  status           varchar(50) NOT NULL DEFAULT 'active',
  owner_user_id    integer REFERENCES users(id) ON DELETE SET NULL,
  segment_id       integer REFERENCES crm_segments(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS crm_companies_org_idx ON crm_companies(organization_id);
CREATE INDEX IF NOT EXISTS crm_companies_status_idx ON crm_companies(status);

-- 5. CRM Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       integer REFERENCES crm_companies(id) ON DELETE SET NULL,
  first_name       varchar(100) NOT NULL,
  last_name        varchar(100),
  email            varchar(150),
  phone            varchar(50),
  position         varchar(255),
  source           varchar(100),
  status           varchar(50) NOT NULL DEFAULT 'active',
  owner_user_id    integer REFERENCES users(id) ON DELETE SET NULL,
  segment_id       integer REFERENCES crm_segments(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS crm_contacts_org_idx ON crm_contacts(organization_id);
CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON crm_contacts(email);

-- 6. CRM Contact Tags (junction)
CREATE TABLE IF NOT EXISTS crm_contact_tags (
  contact_id integer NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  tag_id     integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- 7. CRM Leads
CREATE TABLE IF NOT EXISTS crm_leads (
  id                   serial PRIMARY KEY,
  organization_id      integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id           integer REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id           integer REFERENCES crm_companies(id) ON DELETE SET NULL,
  title                varchar(255) NOT NULL,
  description          text,
  amount               integer NOT NULL DEFAULT 0,
  currency             varchar(3) NOT NULL DEFAULT 'RUB',
  stage                varchar(50) NOT NULL DEFAULT 'new',
  priority             varchar(20) NOT NULL DEFAULT 'medium',
  probability          integer NOT NULL DEFAULT 0,
  source               varchar(100),
  responsible_user_id  integer REFERENCES users(id) ON DELETE SET NULL,
  pipeline_id          integer REFERENCES pipelines(id) ON DELETE SET NULL,
  column_id            integer REFERENCES columns(id) ON DELETE SET NULL,
  lost_reason          text,
  expected_close_date  timestamptz,
  closed_at            timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS crm_leads_org_idx ON crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS crm_leads_stage_idx ON crm_leads(stage);
CREATE INDEX IF NOT EXISTS crm_leads_responsible_idx ON crm_leads(responsible_user_id);

-- 8. CRM Lead Tags (junction)
CREATE TABLE IF NOT EXISTS crm_lead_tags (
  lead_id integer NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  tag_id  integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- 9. CRM Activity (universal log)
CREATE TABLE IF NOT EXISTS crm_activity (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type      varchar(50) NOT NULL,
  entity_id        integer NOT NULL,
  actor_user_id    integer REFERENCES users(id) ON DELETE SET NULL,
  kind             varchar(64) NOT NULL,
  payload          jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_activity_entity_idx ON crm_activity(entity_type, entity_id, created_at);

-- 10. RBAC Permissions
CREATE TABLE IF NOT EXISTS rbac_permissions (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             org_role_v2 NOT NULL DEFAULT 'employee',
  resource_type    varchar(50),
  resource_id      integer,
  granted_by       integer REFERENCES users(id) ON DELETE SET NULL,
  expires_at       timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rbac_user_org_idx ON rbac_permissions(user_id, organization_id);

-- 11. Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             varchar(255) NOT NULL,
  parent_id        integer,
  color            varchar(7),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_categories_org_idx ON product_categories(organization_id);

-- 12. Products
CREATE TABLE IF NOT EXISTS products (
  id                  serial PRIMARY KEY,
  organization_id     integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id         integer REFERENCES product_categories(id) ON DELETE SET NULL,
  name                varchar(255) NOT NULL,
  sku                 varchar(100),
  description         text,
  price               integer NOT NULL DEFAULT 0,
  cost_price          integer NOT NULL DEFAULT 0,
  currency            varchar(3) NOT NULL DEFAULT 'RUB',
  unit                varchar(50) NOT NULL DEFAULT 'шт',
  stock_quantity      integer NOT NULL DEFAULT 0,
  min_stock_quantity  integer NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS products_org_idx ON products(organization_id);
CREATE INDEX IF NOT EXISTS products_sku_idx ON products(organization_id, sku);

-- 13. Catalog Services
CREATE TABLE IF NOT EXISTS catalog_services (
  id               serial PRIMARY KEY,
  organization_id  integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             varchar(255) NOT NULL,
  description      text,
  category         varchar(100),
  price            integer NOT NULL DEFAULT 0,
  currency         varchar(3) NOT NULL DEFAULT 'RUB',
  unit             varchar(50) NOT NULL DEFAULT 'час',
  duration_hours   integer,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS catalog_services_org_idx ON catalog_services(organization_id);
