import { organizationsAPI } from 'shared/api/requests/organizations'
import { removeMember } from 'shared/api/events/organization'
import { RemoveMemberButton as SharedRemoveButton } from 'shared/ui'
import type { OrganizationMember } from 'shared/types/organization'

type RemoveMemberButtonProps = {
  organizationId: number
  member: OrganizationMember
  canManage?: boolean
  onSuccess?: () => void
}

export function RemoveMemberButton({
  organizationId,
  member,
  canManage = false,
  onSuccess,
}: RemoveMemberButtonProps) {
  return (
    <SharedRemoveButton
      canManage={canManage}
      confirmMessage={`Удалить ${member.email} из организации?`}
      onRemove={async () => {
        await organizationsAPI.removeMember(organizationId, member.id)
        removeMember(member.id)
      }}
      onSuccess={onSuccess}
    />
  )
}

