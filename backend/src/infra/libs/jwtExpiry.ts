import config from 'config'
import type { SignOptions } from 'jsonwebtoken'

type ExpiresIn = NonNullable<SignOptions['expiresIn']>

/** Срок жизни JWT при входе по email/паролю и при перевыпуске токена (смена email и т.д.) */
export function getAppJwtExpiresIn(): ExpiresIn {
  return (config.has('jwt.expiresIn') ? config.get<string>('jwt.expiresIn') : '30d') as ExpiresIn
}

