import type { OrganizationMember } from 'shared/types/organization'
import type { DepartmentMember } from 'shared/types/departments'
import styles from './MemberList.module.css'

type MemberWithOptionalRole = { id: number; email: string; firstname: string; lastname: string; role?: string }

type MemberListProps<T extends MemberWithOptionalRole> = {
  title: string
  members: T[]
  showRole?: boolean
  canManage?: boolean
  onAddMember: () => void
  renderRemoveButton: (member: T) => React.ReactNode
}

function MemberList<T extends MemberWithOptionalRole>({
  title,
  members,
  showRole = false,
  canManage = false,
  onAddMember,
  renderRemoveButton,
}: MemberListProps<T>) {
  return (
    <div>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {canManage && (
          <button type="button" onClick={onAddMember} className={styles.addBtn}>
            Добавить
          </button>
        )}
      </div>
      <ul className={styles.list}>
        {members.map((m) => (
          <li key={m.id} className={styles.item}>
            <span>
              {m.firstname} {m.lastname} ({m.email})
              {showRole && m.role && ` — ${m.role}`}
            </span>
            {canManage && renderRemoveButton(m)}
          </li>
        ))}
      </ul>
    </div>
  )
}

type OrgMemberListProps = {
  members: OrganizationMember[]
  organizationId: number
  canManage?: boolean
  onAddMember: () => void
  renderRemoveButton: (member: OrganizationMember) => React.ReactNode
}

export function OrganizationMemberList({
  members,
  canManage,
  onAddMember,
  renderRemoveButton,
}: OrgMemberListProps) {
  return (
    <MemberList
      title="Участники"
      members={members}
      showRole
      canManage={canManage}
      onAddMember={onAddMember}
      renderRemoveButton={renderRemoveButton}
    />
  )
}

type DepMemberListProps = {
  members: DepartmentMember[]
  departmentId: number
  canManage?: boolean
  onAddMember: () => void
  renderRemoveButton: (member: DepartmentMember) => React.ReactNode
}

export function DepartmentMemberList({
  members,
  canManage,
  onAddMember,
  renderRemoveButton,
}: DepMemberListProps) {
  return (
    <MemberList
      title="Участники Раздела"
      members={members}
      canManage={canManage}
      onAddMember={onAddMember}
      renderRemoveButton={renderRemoveButton}
    />
  )
}
