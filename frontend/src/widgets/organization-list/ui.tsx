import { organizationModel } from 'entities/organization'
import { OrganizationCard } from 'entities/organization'
import { CreateOrganizationForm } from 'features/organization/create'
import { useState } from 'react'
import { Button } from 'shared/ui'
import { Modal } from 'shared/ui'
import styles from './OrganizationList.module.css'

export function OrganizationList() {
  const organizations = organizationModel.selectors.useOrganizations()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Организации</h1>
        <Button type="button" onClick={() => setShowCreate(true)}>
          Создать организацию
        </Button>
      </div>
      <div className={styles.grid}>
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} />
        ))}
      </div>
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Создать организацию"
      >
        <CreateOrganizationForm onSuccess={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}
