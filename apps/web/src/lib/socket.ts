import { io, type Socket } from 'socket.io-client'

// El gateway de WebSocket corre en el mismo backend pero fuera del prefijo /api
// (setGlobalPrefix solo aplica al pipeline HTTP de Nest) — por eso usa su propia
// variable de entorno en vez de derivar de VITE_API_URL.
export function crearSocketArea(): Socket {
  return io(import.meta.env.VITE_WS_URL, {
    // Envía la cookie httpOnly accessToken en el handshake, igual que axios en HTTP.
    withCredentials: true,
  })
}
