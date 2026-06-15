import { createEvent } from "effector";
import type { Column} from "shared/types/columns";

export const setColumns = createEvent<Column[]>()
export const addColumn = createEvent<Column>()
export const editColumn = createEvent<Column>()
export const delColumn = createEvent<number>()
export const reorderColumns = createEvent<number[]>()
export const clearColumns = createEvent()