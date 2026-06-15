import { BadRequestError } from './errors.js'

export function validatePositiveId(id: number, fieldName: string): void {
  if (!id) {
    throw new BadRequestError(`Некорректный ${fieldName}`)
  }
}

export function validateNonEmptyString(value: string | undefined, fieldName: string): void {
  if (!value?.trim()) {
    throw new BadRequestError(`${fieldName} обязательно`)
  }
}
