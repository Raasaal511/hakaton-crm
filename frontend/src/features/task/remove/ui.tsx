import { tasksAPI } from 'shared/api/requests/tasks'
import { delTask } from 'shared/api/events/tasks'
import { RemoveMemberButton } from 'shared/ui'
import type { Task } from 'shared/types/tasks'

type RemoveTaskButtonProps = {
  task: Task
  canManage?: boolean
  onSuccess?: () => void
}

export function RemoveTaskButton({
  task,
  canManage = false,
  onSuccess,
}: RemoveTaskButtonProps) {
  return (
    <RemoveMemberButton
      canManage={canManage}
      confirmMessage={`Удалить задачу "${task.name}"?`}
      onRemove={async () => {
        await tasksAPI.delete(task.id)
        delTask(task.id)
      }}
      onSuccess={onSuccess}
    />
  )
}

