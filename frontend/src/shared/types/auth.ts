export type LoginDTO = { email: string; password: string }

export type RegisterDTO = {
  email: string
  password: string
  firstname: string
  lastname: string
}
export type RegisterResponseUser = { id: number; firstname: string; lastname: string }