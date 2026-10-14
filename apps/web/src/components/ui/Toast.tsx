import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type TonoToast = 'success' | 'error' | 'info'

/** Enlace dentro del aviso — p. ej. "Ver en historia clínica" después de guardar. */
export interface AccionToast {
  etiqueta: string
  onClick: () => void
}

interface ToastItem {
  id: number
  tono: TonoToast
  mensaje: string
  accion?: AccionToast
}

interface ContextoToast {
  mostrar: (mensaje: string, tono?: TonoToast, accion?: AccionToast) => void
}

const ToastContext = createContext<ContextoToast | null>(null)

const DURACION_MS = 5000

const ICONO_TONO: Record<TonoToast, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const CLASES_TONO: Record<TonoToast, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-gray-200 bg-white text-gray-800',
}

let siguienteId = 0

/** Un solo punto de avisos para toda la app — evita que cada pantalla invente su propio banner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const quitar = useCallback((id: number) => {
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id))
  }, [])

  const mostrar = useCallback(
    (mensaje: string, tono: TonoToast = 'success', accion?: AccionToast) => {
      const id = siguienteId++
      setToasts((actuales) => [...actuales, { id, tono, mensaje, accion }])
      setTimeout(() => quitar(id), DURACION_MS)
    },
    [quitar],
  )

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastVisual key={toast.id} toast={toast} onCerrar={() => quitar(toast.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastVisual({ toast, onCerrar }: { toast: ToastItem; onCerrar: () => void }) {
  const Icono = ICONO_TONO[toast.tono]
  return (
    <div
      role={toast.tono === 'error' ? 'alert' : 'status'}
      className={`flex w-80 items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg ${CLASES_TONO[toast.tono]}`}
    >
      <Icono size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1">
        {toast.mensaje}
        {toast.accion && (
          <button
            type="button"
            onClick={() => {
              toast.accion!.onClick()
              onCerrar()
            }}
            className="ml-2 font-semibold underline underline-offset-2 hover:no-underline"
          >
            {toast.accion.etiqueta}
          </button>
        )}
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={onCerrar}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  )
}

/** `mostrar(mensaje)` para éxito; `mostrar(mensaje, 'error' | 'info')` para los otros tonos; el tercer argumento añade un enlace. */
export function useToast() {
  const contexto = useContext(ToastContext)
  if (!contexto) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return contexto
}
