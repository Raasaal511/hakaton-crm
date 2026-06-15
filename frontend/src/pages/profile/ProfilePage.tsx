import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button, Input, Modal } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { hasAuthToken } from 'shared/lib'
import { ProfileSettingsLayout } from './ProfileSettingsLayout'
import shared from './ProfileSettingsShared.module.css'
import styles from './ProfilePage.module.css'
import { authAPI } from 'shared/api/requests/auth'
import { setUser } from 'shared/api/events/auth'

function getErrorMessage(e: unknown, fallback: string) {
  const msg =
    (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  return msg ?? (e instanceof Error ? e.message : fallback)
}

export function ProfilePage() {
  const navigate = useNavigate()
  const currentUser = userModel.selectors.useUser()
  const organizations = organizationModel.selectors.useOrganizations()
  const hasToken = hasAuthToken()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasToken) {
      navigate('/auth', { replace: true })
    }
  }, [hasToken, navigate])

  useEffect(() => {
    if (currentUser) {
      setFirstname(currentUser.firstname)
      setLastname(currentUser.lastname)
    }
  }, [currentUser?.id, currentUser?.firstname, currentUser?.lastname])

  const personalOrganization = currentUser
    ? organizations.find((org) => org.isPersonal && org.ownerUserId === currentUser.id)
    : undefined
  const teamOrganizations = organizations.filter(
    (org) => !org.isPersonal || org.ownerUserId !== currentUser?.id,
  )

  const openEditModal = () => {
    setProfileError(null)
    setPasswordError(null)
    setProfileMessage(null)
    setPasswordMessage(null)
    setEmailError(null)
    setEmailMessage(null)
    if (currentUser) setEmailDraft(currentUser.email)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    if (profileSaving || passwordSaving || emailSaving) return
    setIsEditModalOpen(false)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage(null)
    setProfileError(null)
    const f = firstname.trim()
    const l = lastname.trim()
    if (!f || !l) {
      setProfileError('Укажите имя и фамилию')
      return
    }
    try {
      setProfileSaving(true)
      const updated = await authAPI.updateProfile({ firstname: f, lastname: l })
      setUser(updated)
      setProfileMessage('Профиль сохранён')
    } catch (e: unknown) {
      setProfileError(getErrorMessage(e, 'Не удалось сохранить профиль'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailMessage(null)
    try {
      setEmailSaving(true)
      const { user, token } = await authAPI.changeEmail({ email: emailDraft.trim() })
      setUser(user)
      if (token) localStorage.setItem('token', token)
      setEmailMessage('Email обновлён')
    } catch (e: unknown) {
      setEmailError(getErrorMessage(e, 'Не удалось сменить email'))
    } finally {
      setEmailSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают')
      return
    }
    try {
      setPasswordSaving(true)
      await authAPI.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Пароль обновлён')
      const fresh = await authAPI.getMe()
      if (fresh) setUser(fresh)
    } catch (e: unknown) {
      setPasswordError(getErrorMessage(e, 'Не удалось сменить пароль'))
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!hasToken) return null

  if (!currentUser) {
    return (
      <ProfileSettingsLayout>
        <div className={styles.loading}>Загрузка…</div>
      </ProfileSettingsLayout>
    )
  }

  return (
    <ProfileSettingsLayout>
      <section className={shared.panel}>
        <div className={styles.panelHeadRow}>
          <div>
            <h2 className={shared.panelTitle}>Личные данные</h2>
            <p className={shared.panelDesc} style={{ marginBottom: 0 }}>
              Отображаются в задачах и списках участников
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={openEditModal}>
            Редактировать
          </Button>
        </div>
        <div className={styles.profileInfoGrid}>
          <div className={styles.profileInfoItem}>
            <span className={styles.profileInfoLabel}>Имя</span>
            <span className={styles.profileInfoValue}>{currentUser.firstname}</span>
          </div>
          <div className={styles.profileInfoItem}>
            <span className={styles.profileInfoLabel}>Фамилия</span>
            <span className={styles.profileInfoValue}>{currentUser.lastname}</span>
          </div>
          <div className={styles.profileInfoItem}>
            <span className={styles.profileInfoLabel}>Email</span>
            <span className={styles.profileInfoValue}>{currentUser.email}</span>
          </div>
          <div className={styles.profileInfoItem}>
            <span className={styles.profileInfoLabel}>Пароль</span>
            <span
              className={
                currentUser.profilePasswordSet === false
                  ? `${styles.profileInfoValue} ${styles.statusUnset}`
                  : `${styles.profileInfoValue} ${styles.statusOk}`
              }
            >
              {currentUser.profilePasswordSet === false ? 'Не задан' : 'Задан'}
            </span>
          </div>
        </div>
      </section>

      <section className={shared.panel}>
        <h2 className={shared.panelTitle}>Мои организации</h2>
        <p className={shared.panelDesc}>Перейдите к задачам и разделам</p>
        {personalOrganization && (
          <button
            type="button"
            className={`${styles.orgCard} ${styles.orgCardPersonal}`}
            onClick={() => navigate(`/organizations/${personalOrganization.id}`)}
          >
            <div className={`${styles.orgIcon} ${styles.orgIconPersonal}`}>
              {personalOrganization.name[0]?.toUpperCase()}
            </div>
            <div className={styles.orgInfo}>
              <span className={styles.orgName}>{personalOrganization.name}</span>
              <span className={styles.orgMeta}>Личное пространство</span>
            </div>
            <ChevronRight className={styles.orgChevron} size={20} aria-hidden />
          </button>
        )}
        {teamOrganizations.length > 0 ? (
          <div className={styles.orgGrid}>
            {teamOrganizations.map((org) => (
              <button
                key={org.id}
                type="button"
                className={styles.orgCard}
                onClick={() => navigate(`/organizations/${org.id}`)}
              >
                <div className={styles.orgIcon}>{org.name[0]?.toUpperCase()}</div>
                <div className={styles.orgInfo}>
                  <span className={styles.orgName}>{org.name}</span>
                  <span className={styles.orgMeta}>Команда</span>
                </div>
                <ChevronRight className={styles.orgChevron} size={20} aria-hidden />
              </button>
            ))}
          </div>
        ) : !personalOrganization ? (
          <p className={styles.empty}>Создайте организацию на главной странице</p>
        ) : null}
      </section>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Редактирование профиля"
        className={styles.editModal}
      >
        <div className={styles.modalBody}>
          <section className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Имя и фамилия</h3>
            <form className={styles.form} onSubmit={handleSaveProfile}>
              <div className={styles.nameGrid}>
                <Input label="Имя" value={firstname} onChange={(ev) => setFirstname(ev.target.value)} maxLength={25} />
                <Input label="Фамилия" value={lastname} onChange={(ev) => setLastname(ev.target.value)} maxLength={25} />
              </div>
              {profileError && <p className={styles.error}>{profileError}</p>}
              {profileMessage && <p className={styles.success}>{profileMessage}</p>}
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </form>
          </section>
          <section className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Email</h3>
            <form className={styles.form} onSubmit={handleChangeEmail}>
              <Input label="Email" type="email" value={emailDraft} onChange={(ev) => setEmailDraft(ev.target.value)} maxLength={150} />
              {emailError && <p className={styles.error}>{emailError}</p>}
              {emailMessage && <p className={styles.success}>{emailMessage}</p>}
              <Button type="submit" disabled={emailSaving}>
                {emailSaving ? 'Сохранение…' : 'Сохранить email'}
              </Button>
            </form>
          </section>
          <section className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Пароль</h3>
            <form className={styles.form} onSubmit={handleChangePassword}>
              <Input label="Текущий пароль" type="password" value={currentPassword} onChange={(ev) => setCurrentPassword(ev.target.value)} />
              <div className={styles.nameGrid}>
                <Input label="Новый пароль" type="password" value={newPassword} onChange={(ev) => setNewPassword(ev.target.value)} minLength={8} />
                <Input label="Подтверждение" type="password" value={confirmPassword} onChange={(ev) => setConfirmPassword(ev.target.value)} minLength={8} />
              </div>
              {passwordError && <p className={styles.error}>{passwordError}</p>}
              {passwordMessage && <p className={styles.success}>{passwordMessage}</p>}
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Сохранение…' : 'Сменить пароль'}
              </Button>
            </form>
          </section>
        </div>
      </Modal>
    </ProfileSettingsLayout>
  )
}
