import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '../store/auth.store'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

const METODOS_MUTANTES = new Set(['post', 'put', 'patch', 'delete'])

function leerCookie(nombre: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${nombre}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : undefined
}

api.interceptors.request.use((config) => {
  if (config.method && METODOS_MUTANTES.has(config.method)) {
    const csrfToken = leerCookie('csrfToken')
    if (csrfToken) {
      config.headers.set('X-CSRF-Token', csrfToken)
    }
  }
  return config
})

interface RequestEnCola {
  resolve: () => void
  reject: (error: unknown) => void
}

let isRefreshing = false
let failedQueue: RequestEnCola[] = []

function procesarCola(error: unknown): void {
  for (const { resolve, reject } of failedQueue) {
    if (error) {
      reject(error)
    } else {
      resolve()
    }
  }
  failedQueue = []
}

type RequestConReintento = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RequestConReintento | undefined
    const url = originalRequest?.url ?? ''
    // Evita el loop infinito de refresh-sobre-refresh: login y refresh nunca
    // disparan otro refresh a partir de su propio 401.
    const esRutaAuthExcluida =
      url.includes('/auth/login') || url.includes('/auth/refresh')

    if (
      error.response?.status !== 401 ||
      esRutaAuthExcluida ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(() => api(originalRequest))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      await api.post('/auth/refresh')
      procesarCola(null)
      return await api(originalRequest)
    } catch (refreshError) {
      procesarCola(refreshError)
      // Sin redirección dura: ProtectedRoute/PublicRoute ya están suscritos
      // al store y reaccionan solos al cambio de isAuthenticated. Forzar
      // window.location aquí re-montaba la app entera, que volvía a llamar
      // checkAuth() y volvía a fallar igual — recarga infinita cuando no hay
      // sesión (ej. la primera carga de /login sin cookies).
      useAuthStore.getState().limpiarSesion()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
