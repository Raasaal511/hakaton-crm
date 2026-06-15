-- Migration: Core CRM platform domain
-- Adds RBAC groups/audit, CRM deals/documents/comms/automation,
-- inventory accounting, sales documents and realtime board journal.

ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'employee';

CREATE TABLE IF NOT EXISTS rbac_groups (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id integer REFERENCES departments(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  description text,
  parent_group_id integer,
  permissions jsonb NOT NULL DEFAULT '{}',
  data_restrictions jsonb NOT NULL DEFAULT '{}',
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rbac_groups_org_idx ON rbac_groups(organization_id);

CREATE TABLE IF NOT EXISTS rbac_group_members (
  group_id integer NOT NULL REFERENCES rbac_groups(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS rbac_group_members_user_idx ON rbac_group_members(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  organization_id integer REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  entity_type varchar(80) NOT NULL,
  entity_id integer,
  action varchar(80) NOT NULL,
  ip_address varchar(80),
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS crm_lead_sources (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  code varchar(80),
  color varchar(7),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_lead_sources_org_idx ON crm_lead_sources(organization_id);

CREATE TABLE IF NOT EXISTS crm_deal_stages (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  code varchar(80) NOT NULL,
  position integer NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  color varchar(7),
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_deal_stages_org_position_idx ON crm_deal_stages(organization_id, position);

CREATE TABLE IF NOT EXISTS crm_deals (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id integer REFERENCES crm_leads(id) ON DELETE SET NULL,
  contact_id integer REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id integer REFERENCES crm_companies(id) ON DELETE SET NULL,
  stage_id integer REFERENCES crm_deal_stages(id) ON DELETE SET NULL,
  title varchar(255) NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  probability integer NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'open',
  source varchar(100),
  owner_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date timestamptz,
  closed_at timestamptz,
  next_step text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS crm_deals_org_idx ON crm_deals(organization_id);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals(stage_id);
CREATE INDEX IF NOT EXISTS crm_deals_owner_idx ON crm_deals(owner_user_id);

CREATE TABLE IF NOT EXISTS crm_deal_line_items (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id integer NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  product_id integer,
  service_id integer,
  item_type varchar(30) NOT NULL,
  title varchar(255) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  cost_price integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_deal_line_items_deal_idx ON crm_deal_line_items(deal_id);

CREATE TABLE IF NOT EXISTS crm_documents (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type varchar(50) NOT NULL,
  entity_id integer NOT NULL,
  title varchar(255) NOT NULL,
  kind varchar(80) NOT NULL DEFAULT 'attachment',
  file_name varchar(512),
  mime_type varchar(255),
  size_bytes integer,
  template_code varchar(120),
  generated_payload jsonb NOT NULL DEFAULT '{}',
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_documents_entity_idx ON crm_documents(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS crm_communications (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type varchar(50) NOT NULL,
  entity_id integer NOT NULL,
  channel varchar(40) NOT NULL,
  direction varchar(20) NOT NULL DEFAULT 'outbound',
  subject varchar(255),
  body text,
  external_id varchar(255),
  status varchar(40) NOT NULL DEFAULT 'draft',
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_communications_entity_idx ON crm_communications(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS automation_rules (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  trigger_type varchar(80) NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_rules_org_idx ON automation_rules(organization_id);

CREATE TABLE IF NOT EXISTS automation_runs (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id integer REFERENCES automation_rules(id) ON DELETE SET NULL,
  entity_type varchar(50),
  entity_id integer,
  status varchar(40) NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_runs_rule_idx ON automation_runs(rule_id, created_at);

CREATE TABLE IF NOT EXISTS warehouses (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  code varchar(80),
  address text,
  responsible_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouses_org_idx ON warehouses(organization_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id integer REFERENCES warehouses(id) ON DELETE SET NULL,
  target_warehouse_id integer REFERENCES warehouses(id) ON DELETE SET NULL,
  type varchar(40) NOT NULL,
  quantity integer NOT NULL,
  unit_cost integer NOT NULL DEFAULT 0,
  reason text,
  reference_type varchar(50),
  reference_id integer,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS stock_movements_warehouse_idx ON stock_movements(warehouse_id, created_at);

CREATE TABLE IF NOT EXISTS product_price_history (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price integer NOT NULL,
  cost_price integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  changed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_price_history_product_idx ON product_price_history(product_id, created_at);

CREATE TABLE IF NOT EXISTS purchases (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_company_id integer REFERENCES crm_companies(id) ON DELETE SET NULL,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  warehouse_id integer REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost integer NOT NULL DEFAULT 0,
  status varchar(40) NOT NULL DEFAULT 'planned',
  expected_at timestamptz,
  received_at timestamptz,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_org_idx ON purchases(organization_id, created_at);

CREATE TABLE IF NOT EXISTS service_tariffs (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id integer NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  price integer NOT NULL DEFAULT 0,
  cost_price integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  duration_hours integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_tariffs_service_idx ON service_tariffs(service_id);

CREATE TABLE IF NOT EXISTS service_executors (
  service_id integer NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost_rate integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (service_id, user_id)
);

CREATE TABLE IF NOT EXISTS sales_quotes (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id integer REFERENCES crm_deals(id) ON DELETE SET NULL,
  company_id integer REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id integer REFERENCES crm_contacts(id) ON DELETE SET NULL,
  number varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'draft',
  subtotal integer NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  valid_until timestamptz,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_quotes_org_idx ON sales_quotes(organization_id, created_at);

CREATE TABLE IF NOT EXISTS sales_invoices (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id integer REFERENCES crm_deals(id) ON DELETE SET NULL,
  quote_id integer REFERENCES sales_quotes(id) ON DELETE SET NULL,
  number varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'draft',
  total integer NOT NULL DEFAULT 0,
  paid_amount integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_invoices_org_idx ON sales_invoices(organization_id, created_at);

CREATE TABLE IF NOT EXISTS realtime_board_journal (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  board_id varchar(120) NOT NULL,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(80) NOT NULL,
  card_type varchar(40),
  card_id integer,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS realtime_board_journal_board_idx ON realtime_board_journal(organization_id, board_id, created_at);
