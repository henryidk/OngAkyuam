import axios from 'axios'

const MENSAJE_GENERICO = 'Ocurrió un error inesperado. Intente de nuevo.'

export function extraerMensajeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined
    if (Array.isArray(data?.message)) {
      return data.message.join(', ')
    }
    if (typeof data?.message === 'string') {
      return data.message
    }
  }
  return MENSAJE_GENERICO
}
