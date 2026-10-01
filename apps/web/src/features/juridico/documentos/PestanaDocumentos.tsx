import { useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import {
  CARPETAS_SUGERIDAS_POR_TIPO,
  NOMBRE_CARPETA_MAX,
  NOMBRE_DOCUMENTO_MAX,
  normalizarNombreCarpeta,
  type CarpetaDto,
  type DocumentoProcesoDto,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { dispararDescarga } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { crearCarpeta, obtenerUrlDocumento, renombrarCarpeta, renombrarDocumento } from '../api/juridico.api'
import { useContextoDetalle } from '../detalle/contextoDetalle'
import Carpeta from './Carpeta'
import ModalNombre from './ModalNombre'
import ModalSubida from './ModalSubida'

type Dialogo =
  | { tipo: 'subida'; carpetaId?: string; archivos?: File[] }
  | { tipo: 'nuevaCarpeta' }
  | { tipo: 'renombrarCarpeta'; carpeta: CarpetaDto }
  | { tipo: 'renombrarDocumento'; documento: DocumentoProcesoDto }

export default function PestanaDocumentos() {
  const { proceso, refrescar } = useContextoDetalle()
  const { mostrar } = useToast()
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const existentes = new Set(proceso.carpetas.map((carpeta) => normalizarNombreCarpeta(carpeta.nombre)))
  const sugeridas = CARPETAS_SUGERIDAS_POR_TIPO[proceso.tipo].filter(
    (nombre) => !existentes.has(normalizarNombreCarpeta(nombre)),
  )

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault()
    setArrastrando(false)
    const archivos = Array.from(evento.dataTransfer.files)
    if (archivos.length > 0) setDialogo({ tipo: 'subida', archivos })
  }

  function cerrarYRefrescar(mensaje: string) {
    setDialogo(null)
    mostrar(mensaje)
    refrescar()
  }

  async function crearSugerida(nombre: string) {
    try {
      await crearCarpeta(proceso.id, nombre)
      cerrarYRefrescar('Carpeta creada')
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  // La ventana se abre dentro del clic (si se abriera después de esperar la URL, el navegador
  // la bloquearía como ventana emergente) y se le asigna la URL firmada cuando llega.
  async function ver(documento: DocumentoProcesoDto) {
    const ventana = window.open('', '_blank')
    try {
      const url = await obtenerUrlDocumento(proceso.id, documento.id, 'vista')
      if (ventana) {
        ventana.opener = null
        ventana.location.replace(url)
      } else {
        mostrar('El navegador bloqueó la ventana. Permita las ventanas emergentes o use Descargar.', 'error')
      }
    } catch (err) {
      ventana?.close()
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  async function descargar(documento: DocumentoProcesoDto) {
    try {
      dispararDescarga(await obtenerUrlDocumento(proceso.id, documento.id, 'descarga'))
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variante="secondary" onClick={() => setDialogo({ tipo: 'nuevaCarpeta' })}>
          Nueva carpeta
        </Button>
        <Button onClick={() => setDialogo({ tipo: 'subida' })}>Subir documentos</Button>
      </div>

      <div
        onDragOver={(evento) => {
          evento.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center ${
          arrastrando ? 'border-brand-600 bg-brand-50' : 'border-gray-300 bg-white'
        }`}
      >
        <UploadCloud size={22} aria-hidden="true" className="text-gray-400" />
        <p className="text-sm text-gray-700">
          Arrastre aquí los archivos o{' '}
          <button
            type="button"
            onClick={() => setDialogo({ tipo: 'subida' })}
            className="font-medium text-brand-700 hover:underline"
          >
            selecciónelos
          </button>
        </p>
        <p className="text-xs text-gray-500">PDF, JPG, PNG o WEBP · máximo 15 MB por archivo</p>
      </div>

      {proceso.carpetas.map((carpeta) => (
        <Carpeta
          key={carpeta.id}
          carpeta={carpeta}
          onRenombrar={() => setDialogo({ tipo: 'renombrarCarpeta', carpeta })}
          onAgregar={() => setDialogo({ tipo: 'subida', carpetaId: carpeta.id })}
          onVer={(documento) => void ver(documento)}
          onDescargar={(documento) => void descargar(documento)}
          onRenombrarDocumento={(documento) => setDialogo({ tipo: 'renombrarDocumento', documento })}
        />
      ))}

      {sugeridas.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Carpetas sugeridas para este tipo de proceso
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {sugeridas.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => void crearSugerida(nombre)}
                className="rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-brand-600 hover:text-brand-700"
              >
                + {nombre}
              </button>
            ))}
          </div>
        </section>
      )}

      {dialogo?.tipo === 'subida' && (
        <ModalSubida
          procesoId={proceso.id}
          carpetas={proceso.carpetas}
          sugeridas={sugeridas}
          carpetaInicialId={dialogo.carpetaId}
          archivosIniciales={dialogo.archivos}
          onCerrar={(huboCambios) => {
            setDialogo(null)
            if (huboCambios) refrescar()
          }}
        />
      )}
      {dialogo?.tipo === 'nuevaCarpeta' && (
        <ModalNombre
          titulo="Nueva carpeta"
          etiqueta="Nombre de la carpeta"
          maximo={NOMBRE_CARPETA_MAX}
          confirmarLabel="Crear carpeta"
          onCerrar={() => setDialogo(null)}
          onGuardar={async (nombre) => {
            await crearCarpeta(proceso.id, nombre)
            cerrarYRefrescar('Carpeta creada')
          }}
        />
      )}
      {dialogo?.tipo === 'renombrarCarpeta' && (
        <ModalNombre
          titulo="Renombrar carpeta"
          etiqueta="Nombre de la carpeta"
          valorInicial={dialogo.carpeta.nombre}
          maximo={NOMBRE_CARPETA_MAX}
          confirmarLabel="Guardar"
          onCerrar={() => setDialogo(null)}
          onGuardar={async (nombre) => {
            await renombrarCarpeta(proceso.id, dialogo.carpeta.id, nombre)
            cerrarYRefrescar('Carpeta renombrada')
          }}
        />
      )}
      {dialogo?.tipo === 'renombrarDocumento' && (
        <ModalNombre
          titulo="Renombrar documento"
          etiqueta="Nombre visible"
          valorInicial={dialogo.documento.nombreVisible}
          maximo={NOMBRE_DOCUMENTO_MAX}
          confirmarLabel="Guardar"
          onCerrar={() => setDialogo(null)}
          onGuardar={async (nombre) => {
            await renombrarDocumento(proceso.id, dialogo.documento.id, nombre)
            cerrarYRefrescar('Documento renombrado')
          }}
        />
      )}
    </div>
  )
}
