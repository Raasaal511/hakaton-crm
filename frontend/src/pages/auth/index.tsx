import { LoginForm } from 'features/auth/login'
import { Link } from 'react-router-dom'
import styles from './AuthPage.module.css'

export function AuthPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <img src="/logo.png" alt="Логотип" className={styles.logo} />
        <h1 className={styles.title}>Meridian</h1>
        <p className={styles.subtitle}>Войдите в систему</p>
        <LoginForm />
        <p className={styles.footer}>
          Нет аккаунта?{' '}
          <Link to="/register" className={styles.link}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
