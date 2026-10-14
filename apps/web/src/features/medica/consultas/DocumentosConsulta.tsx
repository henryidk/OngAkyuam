import { useRef, useState, type DragEvent } from 'react'
import { ETIQUETAS_TIPO_DOCUMENTO_MEDICO, TIPOS_DOCUMENTO_MEDICO, type TipoDocumentoMedico } from '@akyuam/shared'
import { ACCEPT_DOCUMENTOS } from '../../../lib/documentos/archivoDocumento'
import { CLASE_TARJETA } from '../compartido/estilos'
import type { DocumentosConsultaEstado, ItemDocumento } from './useDocumentosConsulta'

const CLASE_BOTON = 'whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-[12.5px] font-medium'

/** Tarjeta "Documentos" del formulario: botón, zona de arrastre y la lista de subidas. */
export default function DocumentosConsulta({ documentos, deshabilitado }: { documentos: DocumentosConsultaEstado; deshabilitado: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const { items, tipos, adjuntar, cambiarTipo, eliminar, reintentar } = documentos

  function soltar(evento: DragEvent) {
    evento.preventDefault()
    setArrastrando(false)
    if (!deshabilitado) adjuntar(Array.from(evento.dataTransfer.files))
  }

  const listos = items.filter((item) => item.estado === 'listo').length
  const anuncio = items.length === 0 ? '' : `${listos} de ${items.length} documentos subidos`

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3 px-5 py-[18px]`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-[#1c2430]">Documentos</h2>
          <p className="text-[12.5px] text-[#5b6573]">
            Resultados de laboratorio, recetas, órdenes, constancias. PDF o imagen, máx. 15 MB.
          </p>
        </div>
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => input.current?.click()}
          className={`${CLASE_BOTON} border-[#7346a5] font-semibold text-[#7346a5] hover:bg-[#f7f3fc] disabled:opacity-50`}
        >
          + Adjuntar archivos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_DOCUMENTOS}
          className="hidden"
          onChange={(evento) => {
            adjuntar(Array.from(evento.target.files ?? []))
            evento.target.value = ''
          }}
        />
      </div>

      <div
        onDragOver={(evento) => {
          evento.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={`rounded-md border border-dashed px-4 py-4 text-center text-[12.5px] text-[#5b6573] ${
          arrastrando ? 'border-[#7346a5] bg-[#f7f3fc]' : 'border-[#d5dadf]'
        }`}
      >
        Arrastra archivos aquí o usa «Adjuntar archivos».
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <FilaSubida
              key={item.id}
              item={item}
              tipo={tipos[item.id] ?? 'OTRO'}
              deshabilitado={deshabilitado}
              onTipo={(tipo) => void cambiarTipo(item, tipo)}
              onQuitar={() => void eliminar(item)}
              onReintentar={() => void reintentar(item.id)}
            />
          ))}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </section>
  )
}

interface FilaSubidaProps {
  item: ItemDocumento
  tipo: TipoDocumentoMedico
  deshabilitado: boolean
  onTipo: (tipo: TipoDocumentoMedico) => void
  onQuitar: () => void
  onReintentar: () => void
}

function FilaSubida({ item, tipo, deshabilitado, onTipo, onQuitar, onReintentar }: FilaSubidaProps) {
  const error = item.estado === 'error'
  const listo = item.estado === 'listo'
  const icono = error
    ? { simbolo: '!', clase: 'bg-[#fbe4e1] text-[#9b2c20]' }
    : listo
      ? { simbolo: '✓', clase: 'bg-[#3f9d5b] text-white' }
      : { simbolo: '↑', clase: 'bg-[#f2ecfa] text-[#7346a5]' }
  const estado = error ? `Falló · ${item.error ?? 'error desconocido'}` : listo ? 'Subido' : `${item.progreso}%`

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
        error ? 'border-[#f3c4bd] bg-[#fdf3f1]' : 'border-[#e3e6ea] bg-white'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold ${icono.clase}`}
      >
        {icono.simbolo}
      </span>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-[#1c2430]">{item.nombreVisible || item.archivo.name}</span>
          <span className={`whitespace-nowrap text-[11.5px] ${error ? 'text-[#9b2c20]' : listo ? 'text-[#2f6b3f]' : 'text-[#5b6573]'}`}>
            {estado}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[#eef0f2]">
          <div
            className={`h-full rounded-full transition-[width] ${error ? 'bg-[#d4574a]' : 'bg-[#7346a5]'}`}
            style={{ width: `${error ? 100 : item.progreso}%` }}
          />
        </div>
      </div>
      <select
        aria-label={`Tipo de ${item.nombreVisible || item.archivo.name}`}
        value={tipo}
        disabled={deshabilitado || item.estado === 'subiendo' || item.invalido}
        onChange={(evento) => onTipo(evento.target.value as TipoDocumentoMedico)}
        className="rounded-md border border-[#d5dadf] bg-white px-2 py-1.5 text-[12.5px] text-[#1c2430] disabled:opacity-60"
      >
        {TIPOS_DOCUMENTO_MEDICO.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_TIPO_DOCUMENTO_MEDICO[opcion]}
          </option>
        ))}
      </select>
      {error && !item.invalido && (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={onReintentar}
          className={`${CLASE_BOTON} border-[#9b2c20] text-[#9b2c20] hover:bg-[#fbe4e1]`}
        >
          Reintentar
        </button>
      )}
      <button
        type="button"
        disabled={deshabilitado}
        onClick={onQuitar}
        aria-label={`Quitar ${item.nombreVisible || item.archivo.name}`}
        className={`${CLASE_BOTON} border-[#d5dadf] text-[#5b6573] hover:bg-[#f8f9fa]`}
      >
        Quitar
      </button>
    </li>
  )
}
