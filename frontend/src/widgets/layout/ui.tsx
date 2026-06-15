import { Outlet } from 'react-router-dom'
import { Header } from 'widgets/header'
import styles from './MainLayout.module.css'

export function MainLayout() {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
