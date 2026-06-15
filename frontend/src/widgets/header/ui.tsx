import { Link } from 'react-router-dom'
import { userModel } from 'entities/user'
import { clearUser } from 'shared/api/events/auth'
import { Button } from 'shared/ui'
import styles from './Header.module.css'

/** @deprecated Legacy header — use AppLayout+TopBar instead */
export function Header() {
  const user = userModel.selectors.useUser()

  const handleLogout = () => {
    localStorage.removeItem('token')
    clearUser()
  }

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        Rasl Tasks
      </Link>
      <div className={styles.userInfo}>
        {user && (
          <span className={styles.userName}>
            {user.firstname} {user.lastname}
          </span>
        )}
        <Button variant="secondary" type="button" onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </header>
  )
}
