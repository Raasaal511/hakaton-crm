-- Rasl CRM — initial schema

CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member', 'viewer');
CREATE TYPE "public"."system_role" AS ENUM('user', 'root');
CREATE TYPE "public"."department_role" AS ENUM('member', 'admin');

CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "firstname" varchar(25) NOT NULL,
    "lastname" varchar(25) NOT NULL,
    "email" varchar(150) NOT NULL DEFAULT '',
    "hash_password" varchar(255) NOT NULL,
    "profile_password_set" boolean NOT NULL DEFAULT true,
    "system_role" "system_role" NOT NULL DEFAULT 'user',
    "preferences" jsonb NOT NULL DEFAULT '{}',
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "organizations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(25) NOT NULL,
    "is_personal" boolean NOT NULL DEFAULT false,
    "owner_user_id" integer,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "users_to_organizations" (
    "user_id" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "role" "organization_role" NOT NULL DEFAULT 'member',
    CONSTRAINT "users_to_organizations_user_id_organization_id_pk" PRIMARY KEY("user_id", "organization_id")
);

CREATE TABLE "departments" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "organization_id" integer NOT NULL,
    "position" integer NOT NULL DEFAULT 0,
    "permissions" jsonb NOT NULL DEFAULT '{}',
    "policies" jsonb NOT NULL DEFAULT '{}',
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "users_to_departments" (
    "user_id" integer NOT NULL,
    "department_id" integer NOT NULL,
    "role" "department_role" NOT NULL DEFAULT 'member',
    CONSTRAINT "users_to_departments_user_id_department_id_pk" PRIMARY KEY("user_id", "department_id")
);

CREATE TABLE "pipelines" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "department_id" integer NOT NULL,
    "is_main_template" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "user_favorite_pipelines" (
    "user_id" integer NOT NULL,
    "pipeline_id" integer NOT NULL,
    "created_at" timestamp DEFAULT now(),
    PRIMARY KEY ("user_id", "pipeline_id")
);

CREATE TABLE "columns" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "position" integer NOT NULL,
    "department_id" integer NOT NULL,
    "pipeline_id" integer,
    "color" varchar(7),
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "tags" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "organization_id" integer NOT NULL,
    "department_id" integer,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "tasks" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "column_id" integer,
    "responsible_id" integer,
    "creator_id" integer,
    "start_date" timestamp,
    "dead_line" timestamp,
    "position" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "completed_at" timestamp,
    "broadcast_parent_id" integer,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "task_tags" (
    "task_id" integer NOT NULL,
    "tag_id" integer NOT NULL,
    CONSTRAINT "task_tags_task_id_tag_id_pk" PRIMARY KEY("task_id", "tag_id")
);

CREATE TABLE "task_responsibles" (
    "task_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    CONSTRAINT "task_responsibles_task_id_user_id_pk" PRIMARY KEY("task_id", "user_id")
);

CREATE TABLE "task_attachments" (
    "id" serial PRIMARY KEY NOT NULL,
    "task_id" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "file_name" varchar(512) NOT NULL,
    "mime_type" varchar(255),
    "size_bytes" integer NOT NULL,
    "stored_file_name" varchar(64) NOT NULL,
    "uploaded_by_user_id" integer,
    "created_at" timestamp DEFAULT now(),
    CONSTRAINT "task_attachments_stored_file_name_unique" UNIQUE("stored_file_name")
);

CREATE TABLE "task_comments" (
    "id" serial PRIMARY KEY NOT NULL,
    "task_id" integer NOT NULL,
    "author_id" integer,
    "body" text NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    "deleted_at" timestamp
);

CREATE TABLE "task_activity" (
    "id" serial PRIMARY KEY NOT NULL,
    "task_id" integer NOT NULL,
    "actor_user_id" integer,
    "kind" varchar(64) NOT NULL,
    "payload" jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "web_push_subscriptions" (
    "id" serial PRIMARY KEY,
    "user_id" integer NOT NULL,
    "endpoint" text NOT NULL UNIQUE,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Foreign keys
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users_to_organizations" ADD CONSTRAINT "users_to_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users_to_organizations" ADD CONSTRAINT "users_to_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users_to_departments" ADD CONSTRAINT "users_to_departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users_to_departments" ADD CONSTRAINT "users_to_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_favorite_pipelines" ADD CONSTRAINT "user_favorite_pipelines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_favorite_pipelines" ADD CONSTRAINT "user_favorite_pipelines_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "columns" ADD CONSTRAINT "columns_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "columns" ADD CONSTRAINT "columns_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tags" ADD CONSTRAINT "tags_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_broadcast_parent_id_tasks_id_fk" FOREIGN KEY ("broadcast_parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_responsibles" ADD CONSTRAINT "task_responsibles_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_responsibles" ADD CONSTRAINT "task_responsibles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Indexes
CREATE INDEX "pipelines_department_idx" ON "pipelines" USING btree ("department_id");
CREATE INDEX "user_favorite_pipelines_user_id_idx" ON "user_favorite_pipelines" ("user_id");
CREATE INDEX "department_position_idx" ON "columns" USING btree ("department_id", "position");
CREATE INDEX "pipeline_position_idx" ON "columns" USING btree ("pipeline_id", "position");
CREATE INDEX "column_position_idx" ON "tasks" USING btree ("column_id", "position");
CREATE INDEX "task_responsibles_user_idx" ON "task_responsibles" USING btree ("user_id");
CREATE INDEX "task_attachments_task_idx" ON "task_attachments" USING btree ("task_id");
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id");
CREATE INDEX "task_activity_task_created_idx" ON "task_activity" USING btree ("task_id", "created_at" DESC);
CREATE INDEX "web_push_subscriptions_user_id_idx" ON "web_push_subscriptions" ("user_id");
CREATE INDEX "department_organization_position_idx" ON "departments" ("organization_id", "position");
CREATE INDEX "tasks_broadcast_parent_idx" ON "tasks" ("broadcast_parent_id") WHERE "broadcast_parent_id" IS NOT NULL;
