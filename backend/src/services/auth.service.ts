import { injectable, inject } from 'inversify'
import { TYPES } from '../types.js'
import type {
  IAuthRepository,
  CreateUserDTO,
  LoginUserDTO,
  UpdateProfileDTO,
  ChangePasswordDTO,
  ChangeEmailDTO,
} from '../entities/auth/index.js'
import { BadRequestError, NoAccessToken, NotFoundError } from '../infra/libs/errors.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import config from 'config'
import { getAppJwtExpiresIn } from '../infra/libs/jwtExpiry.js'
import { parseUserPreferencesPatch, type UserPreferences } from '../entities/user/user.preferences.js'

const JWT_TOKEN = config.get<string>('jwt.token')

@injectable()
export class AuthService {
  constructor(@inject(TYPES.AuthRepository) private authRepository: IAuthRepository) {}

  async getMe(userId: number) {
    const user = await this.authRepository.getUserById(userId)
    if (!user) throw new NotFoundError('Пользователь не найден')
    return user
  }

  async login({email, password}: LoginUserDTO) {
    if (!email || !password) throw new BadRequestError('Введите корректные данные')

    const user = await this.authRepository.getUserByEmail(email)
    if (!user) throw new NoAccessToken('Неверный email или пароль!')

    const isMatch = await bcrypt.compare(password, user.hashPassword)
    if (!isMatch) throw new NoAccessToken('Неверный email или пароль!')

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_TOKEN, {
      expiresIn: getAppJwtExpiresIn(),
    })
    return token
  }

  async register({email, password, firstname, lastname}: CreateUserDTO) {
    if (!email || !password || !firstname || !lastname) {
      throw new BadRequestError('Введите корректные данные')
    }
    const user = await this.authRepository.getUserByEmail(email)
    if (user) throw new BadRequestError('Такой пользователь уже существует')

    const hashPassword = await bcrypt.hash(password, 10)
    const result = await this.authRepository.createUser({
      email,
      hashPassword,
      firstname,
      lastname,
      profilePasswordSet: true,
    })
    return result
  }

  async updateProfile(userId: number, dto: UpdateProfileDTO) {
    const user = await this.authRepository.getUserById(userId)
    if (!user) throw new NotFoundError('Пользователь не найден')

    const f = dto.firstname?.trim() ?? ''
    const l = dto.lastname?.trim() ?? ''
    if (!f || !l) throw new BadRequestError('Имя и фамилия обязательны')
    if (f.length > 25 || l.length > 25) {
      throw new BadRequestError('Имя и фамилия не длиннее 25 символов')
    }
    await this.authRepository.updateProfile(userId, { firstname: f, lastname: l })
    const updated = await this.authRepository.getUserById(userId)
    if (!updated) throw new NotFoundError('Пользователь не найден')
    return updated
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  private isValidEmail(email: string) {
    if (email.length > 150) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async changeEmail(userId: number, dto: ChangeEmailDTO) {
    const next = this.normalizeEmail(dto.email ?? '')
    if (!next || !this.isValidEmail(next)) {
      throw new BadRequestError('Укажите корректный email')
    }

    const user = await this.authRepository.getUserById(userId)
    if (!user) throw new NotFoundError('Пользователь не найден')

    const currentNorm = this.normalizeEmail(user.email)
    if (next === currentNorm) {
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_TOKEN, {
        expiresIn: getAppJwtExpiresIn(),
      })
      return { user, token }
    }

    const taken = await this.authRepository.getUserByEmailLower(next)
    if (taken && taken.id !== userId) {
      throw new BadRequestError('Этот email уже занят')
    }

    await this.authRepository.updateEmail(userId, next)
    const updated = await this.authRepository.getUserById(userId)
    if (!updated) throw new NotFoundError('Пользователь не найден')

    const token = jwt.sign({ id: updated.id, email: updated.email }, JWT_TOKEN, {
      expiresIn: getAppJwtExpiresIn(),
    })
    return { user: updated, token }
  }

  async getPreferences(userId: number): Promise<UserPreferences> {
    return this.authRepository.getUserPreferences(userId)
  }

  async updatePreferences(userId: number, body: unknown): Promise<UserPreferences> {
    const patch = parseUserPreferencesPatch(body)
    if (!patch) throw new BadRequestError('Укажите настройки для сохранения')
    const current = await this.authRepository.getUserPreferences(userId)
    const next: UserPreferences = {
      notifications: { ...current.notifications, ...patch.notifications },
      appearance: { ...current.appearance, ...patch.appearance },
    }
    return this.authRepository.updateUserPreferences(userId, next)
  }

  async changePassword(userId: number, dto: ChangePasswordDTO) {
    const newPassword = dto.newPassword?.trim() ?? ''
    if (newPassword.length < 8) {
      throw new BadRequestError('Новый пароль: не короче 8 символов')
    }
    const row = await this.authRepository.getUserForPasswordChange(userId)
    if (!row) throw new NotFoundError('Пользователь не найден')

    const cur = dto.currentPassword?.trim() ?? ''
    if (!cur) throw new BadRequestError('Введите текущий пароль')
    const ok = await bcrypt.compare(cur, row.hashPassword)
    if (!ok) throw new BadRequestError('Неверный текущий пароль')

    const hash = await bcrypt.hash(newPassword, 10)
    await this.authRepository.updatePassword(userId, hash, true)
  }
}
