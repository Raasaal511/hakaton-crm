import type { Department } from 'shared/types/departments'
import { Link } from 'react-router-dom'
import styles from './DepartmentCard.module.css'

type DepartmentCardProps = {
  department: Department
}

export function DepartmentCard({ department }: DepartmentCardProps) {
  return (
    <Link to={`/departments/${department.id}`} className={styles.card}>
      <h3 className={styles.title}>{department.name}</h3>
      <p className={styles.subtitle}>ID: {department.id}</p>
    </Link>
  )
}
