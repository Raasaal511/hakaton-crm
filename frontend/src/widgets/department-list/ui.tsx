import { departmentModel } from 'entities/department'
import { DepartmentCard } from 'entities/department'
import { CreateDepartmentForm } from 'features/department/create'
import { useState } from 'react'
import { Button } from 'shared/ui'
import { Modal } from 'shared/ui'
import styles from './DepartmentList.module.css'

type DepartmentListProps = {
  organizationId: number
  canManage?: boolean
}

export function DepartmentList({ organizationId, canManage = false }: DepartmentListProps) {
  const departments = departmentModel.selectors.useDepartments()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.title}>Разделы</h2>
        {canManage && (
          <Button type="button" onClick={() => setShowCreate(true)}>
            Создать раздел
          </Button>
        )}
      </div>
      <div className={styles.grid}>
        {departments.map((dep) => (
          <DepartmentCard key={dep.id} department={dep} />
        ))}
      </div>
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Создать раздел"
      >
        <CreateDepartmentForm
          organizationId={organizationId}
          onSuccess={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  )
}
