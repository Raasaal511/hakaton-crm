import { columnsAPI } from 'shared/api/requests/columns'
import { delColumn } from 'shared/api/events/columns'
import { RemoveMemberButton } from 'shared/ui'
import type { Column } from 'shared/types/columns'

type RemoveColumnButtonProps = {
  column: Column
  canManage?: boolean
  onSuccess?: () => void
}

export function RemoveColumnButton({
  column,
  canManage = false,
  onSuccess,
}: RemoveColumnButtonProps) {
  return (
    <RemoveMemberButton
      canManage={canManage}
      confirmMessage={`Удалить колонку "${column.name}"?`}
      onRemove={async () => {
        await columnsAPI.delete(column.departmentId, column.id)
        delColumn(column.id)
      }}
      onSuccess={onSuccess}
    />
  )
}
