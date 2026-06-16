-- Migration: Projects module
-- Adds projects table and project_members junction table.

CREATE TABLE IF NOT EXISTS projects (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  status varchar(50) NOT NULL DEFAULT 'planning',
  priority varchar(20) NOT NULL DEFAULT 'medium',
  owner_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  start_date timestamptz,
  end_date timestamptz,
  budget integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  progress integer NOT NULL DEFAULT 0,
  color varchar(7) DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS projects_org_idx    ON projects(organization_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_owner_idx  ON projects(owner_user_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    integer NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       varchar(30) NOT NULL DEFAULT 'member',
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx    ON project_members(user_id);
