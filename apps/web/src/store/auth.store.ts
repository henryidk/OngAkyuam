import { create } from 'zustand'
import { api } from '../lib/api'
import type { Rol } from '../lib/roles'

export interface UsuarioAutenticado {
  id: string
  username: string
  nombreCompleto: string
  rol: Rol
  mustChangePassword: boolean
}

interface AuthState {
  usuario: UsuarioAutenticado | null
  isAuthenticated: boolean
  isLoading: boolean
  checkAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<UsuarioAutenticado>
  logout: () => Promise<void>
  setUsuario: (usuario: UsuarioAutenticado) => void
  limpiarSesion: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  isAuthenticated: false,
  isLoading: true,

  checkAuth: async () => {
    try {
      const { data } = await api.get<UsuarioAutenticado>('/auth/me')
      set({ usuario: data, isAuthenticated: true, isLoading: false })
    } catch {
      set({ usuario: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (username, password) => {
    const { data } = await api.post<{ usuario: UsuarioAutenticado }>(
      '/auth/login',
      { username, password },
    )
    set({ usuario: data.usuario, isAuthenticated: true, isLoading: false })
    return data.usuario
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      set({ usuario: null, isAuthenticated: false, isLoading: false })
    }
  },

  setUsuario: (usuario) => set({ usuario }),

  limpiarSesion: () =>
    set({ usuario: null, isAuthenticated: false, isLoading: false }),
}))
