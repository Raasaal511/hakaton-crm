import { departmentsAPI } from 'shared/api/requests/departments'
import { removeDepartmentMember } from 'shared/api/events/department'
import { RemoveMemberButton } from 'shared/ui'
import type { DepartmentMember } from 'shared/types/departments'

type RemoveDepartmentMemberButtonProps = {
  departmentId: number
  member: DepartmentMember
  canManage?: boolean
  onSuccess?: () => void
}

export function RemoveDepartmentMemberButton({
  departmentId,
  member,
  canManage = false,
  onSuccess,
}: RemoveDepartmentMemberButtonProps) {
  return (
    <RemoveMemberButton
      canManage={canManage}
      confirmMessage={`Удалить ${member.email} из Раздела?`}
      onRemove={async () => {
        await departmentsAPI.deleteUser(departmentId, member.id)
        removeDepartmentMember(member.id)
      }}
      onSuccess={onSuccess}
    />
  )
}
