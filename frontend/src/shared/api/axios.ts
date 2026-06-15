import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '../config'

interface ApiErrorResponse {
  message?: string | string[]
  error?: string | string[]
  [key: string]: unknown
}

export const axiosAPI = axios.create({
  baseURL: API_URL,
})

const getErrorMessage = (error: AxiosError<ApiErrorResponse>): string => {
  const { response, message } = error
  const data = response?.data

  if (data) {
    if (typeof data === 'string') return data
    if (Array.isArray(data)) return data.join(', ')
    
    const serverMessage = data.message || data.error
    if (typeof serverMessage === 'string') return serverMessage
    if (Array.isArray(serverMessage)) return serverMessage.join(', ')
  }

  if (message === 'Network Error') {
    return 'Проблема с сетью. Проверьте подключение к интернету.'
  }

  if (response?.status) {
    return `Ошибка ${response.status}. Попробуйте ещё раз.`
  }

  return 'Произошла непредвиденная ошибка.'
}

axiosAPI.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosAPI.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }

    error.message = getErrorMessage(error)
    
    return Promise.reject(error)
  }
)