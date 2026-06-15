import { Tag } from "../../infra/database/drizzle/schema";
import { CreateTagDTO, UpdateTagDTO } from "./tags.types";

export interface ITagsRepository {
  getTagsByDepartmentId(departmentId: number): Promise<Tag[]>
  searchTagsByDepartment(departmentId: number, query: string): Promise<Tag[]>
  getTagsByTaskId(taskId: number): Promise<Tag[]>
  setTagsForTask(taskId: number, tagIds: number[]): Promise<void>
  getTagById(id: number): Promise<Tag | null>
  createTag(dto: CreateTagDTO): Promise<Tag>
  updateTag(id: number, dto: UpdateTagDTO): Promise<Tag>
  deleteTag(id: number): Promise<void>
}