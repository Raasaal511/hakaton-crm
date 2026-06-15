import { RegisterForm } from 'features/auth/register'
import { Link } from 'react-router-dom'
import styles from './RegisterPage.module.css'

export function RegisterPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <img src="/logo.png" alt="Логотип" className={styles.logo} />
        <h1 className={styles.title}>Rasl Tasks</h1>
        <p className={styles.subtitle}>Регистрация в Rasl Tasks</p>
        <RegisterForm />
        <p className={styles.footer}>
          Уже есть аккаунт?{' '}
          <Link to="/auth" className={styles.link}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
