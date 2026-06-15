import type { Organization } from 'shared/types/organization'
import { Link } from 'react-router-dom'
import styles from './OrganizationCard.module.css'

type OrganizationCardProps = {
  organization: Organization
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Link to={`/organizations/${organization.id}`} className={styles.card}>
      <h3 className={styles.title}>{organization.name}</h3>
      <p className={styles.subtitle}>ID: {organization.id}</p>
    </Link>
  )
}
