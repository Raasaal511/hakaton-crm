import type { Tag } from "../../infra/database/drizzle/schema.js";

export type CreateTagDTO = Pick<Tag, 'name' | 'organizationId'> & { departmentId?: number }
export type UpdateTagDTO = Pick<Tag, 'name'>