import { createStore } from "effector";
import { useUnit } from "effector-react";
import {
    setColumns,
    addColumn,
    editColumn,
    delColumn,
    reorderColumns,
    clearColumns
} from 'shared/api/events/columns'

import type { Column } from "shared/types/columns";

export const $columnsStore = createStore<Column[]>([])
    .on(setColumns, (_, cols) => cols)
    .on(addColumn, (cols, col) => [...cols, col])
    .on(editColumn, (cols, col) =>
        cols.map((c) => (c.id === col.id ? { ...c, ...col } : c))
    )
    .on(delColumn, (cols, id) =>
        cols.filter(c => c.id !== id)
    )
    .on(
        reorderColumns,
        (cols, columnIds) => {
            const byId = new Map(cols.map((c) => [c.id, c]))
            return columnIds
                .map((id, position) => {
                    const col = byId.get(id)
                    return col ? { ...col, position } : null
                })
                .filter((c): c is Column => c !== null)
        }
    )
    .on(clearColumns, () => [])

export const useColumns = () => useUnit($columnsStore)

export const selectors = {
    useColumns,
}