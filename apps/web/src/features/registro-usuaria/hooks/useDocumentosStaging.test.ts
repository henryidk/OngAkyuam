import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentoPendienteSubido } from '@akyuam/shared'
import { descartarDocumentoPendiente, subirDocumentoPendiente } from '../../trabajo-social/api/trabajoSocial.api'
import { useDocumentosStaging } from './useDocumentosStaging'

vi.mock('../../trabajo-social/api/trabajoSocial.api', () => ({
  subirDocumentoPendiente: vi.fn(),
  descartarDocumentoPendiente: vi.fn(),
}))

const subir = vi.mocked(subirDocumentoPendiente)
const descartar = vi.mocked(descartarDocumentoPendiente)

function archivoFicticio(nombre = 'entrevista-ficticia.pdf', tipo = 'application/pdf') {
  return new File(['contenido'], nombre, { type: tipo })
}

function subidoFicticio(id: string): DocumentoPendienteSubido {
  return { id, tipo: 'ENTREVISTA_USUARIA', nombreArchivo: 'entrevista-ficticia.pdf', tamanioBytes: 9 }
}

/** Promesa controlable a mano, para ver el estado "subiendo" antes de que termine. */
function diferida<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (error: unknown) => void
  const promesa = new Promise<T>((res, rej) => {
    resolver = res
    rechazar = rej
  })
  return { promesa, resolver, rechazar }
}

describe('useDocumentosStaging', () => {
  beforeEach(() => {
    subir.mockReset()
    descartar.mockReset()
    descartar.mockResolvedValue(undefined)
  })

  it('sube en cuanto se elige el archivo, muestra el progreso y luego queda subido', async () => {
    const subida = diferida<DocumentoPendienteSubido>()
    let reportarProgreso: (porcentaje: number) => void = () => {}
    subir.mockImplementation((_tipo, _archivo, onProgreso) => {
      reportarProgreso = onProgreso
      return subida.promesa
    })
    const { result } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subiendo', progreso: 0 })
    expect(result.current.haySubidasEnCurso).toBe(true)

    act(() => reportarProgreso(60))
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subiendo', progreso: 60 })

    await act(async () => subida.resolver(subidoFicticio('pend-1')))
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({
      estado: 'subido',
      pendienteId: 'pend-1',
    })
    expect(result.current.haySubidasEnCurso).toBe(false)
    expect(result.current.idsParaRegistrar('EXTERNA')).toEqual(['pend-1'])
  })

  it('rechaza un archivo inválido sin enviarlo y sin opción de reintentar', () => {
    const { result } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio('pagina.html', 'text/html')))

    expect(subir).not.toHaveBeenCalled()
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({
      estado: 'error',
      reintentable: false,
    })
  })

  it('si la subida falla queda en error y Reintentar vuelve a subir el mismo archivo', async () => {
    subir.mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce(subidoFicticio('pend-2'))
    const { result } = renderHook(() => useDocumentosStaging())
    const archivo = archivoFicticio()

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivo))
    await waitFor(() =>
      expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({ estado: 'error', reintentable: true }),
    )

    act(() => result.current.reintentar('ENTREVISTA_USUARIA'))
    await waitFor(() =>
      expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subido' }),
    )
    expect(subir).toHaveBeenCalledTimes(2)
    expect(subir.mock.calls[1][1]).toBe(archivo)
  })

  it('Quitar y Cambiar borran del servidor el archivo anterior', async () => {
    subir.mockResolvedValueOnce(subidoFicticio('pend-1')).mockResolvedValueOnce(subidoFicticio('pend-2'))
    const { result } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    await waitFor(() => expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA?.estado).toBe('subido'))

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio('otra.pdf')))
    expect(descartar).toHaveBeenCalledWith('pend-1')
    await waitFor(() => expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA?.estado).toBe('subido'))

    act(() => result.current.quitarArchivo('ENTREVISTA_USUARIA'))
    expect(descartar).toHaveBeenCalledWith('pend-2')
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toBeUndefined()
  })

  it('una subida que termina después de quitar el archivo se borra del servidor', async () => {
    const subida = diferida<DocumentoPendienteSubido>()
    subir.mockReturnValue(subida.promesa)
    const { result } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    act(() => result.current.quitarArchivo('ENTREVISTA_USUARIA'))
    await act(async () => subida.resolver(subidoFicticio('pend-tarde')))

    expect(descartar).toHaveBeenCalledWith('pend-tarde')
    expect(result.current.documentosPorTipo.ENTREVISTA_USUARIA).toBeUndefined()
  })

  it('no envía documentos de albergue si el registro quedó como Externa', async () => {
    subir.mockResolvedValueOnce({ ...subidoFicticio('pend-albergue'), tipo: 'CONVENIO_INGRESO' })
    const { result } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('CONVENIO_INGRESO', archivoFicticio()))
    await waitFor(() => expect(result.current.documentosPorTipo.CONVENIO_INGRESO?.estado).toBe('subido'))

    expect(result.current.idsParaRegistrar('EXTERNA')).toEqual([])
    expect(result.current.idsParaRegistrar('INTERNA')).toEqual(['pend-albergue'])
  })

  it('al salir del wizard borra lo subido que no se adjuntó a un caso, nunca lo adjuntado', async () => {
    subir
      .mockResolvedValueOnce(subidoFicticio('pend-adjuntado'))
      .mockResolvedValueOnce({ ...subidoFicticio('pend-suelto'), tipo: 'CONVENIO_INGRESO' })
    const { result, unmount } = renderHook(() => useDocumentosStaging())

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    act(() => result.current.seleccionarArchivo('CONVENIO_INGRESO', archivoFicticio('convenio.pdf')))
    await waitFor(() => expect(result.current.documentos.every((d) => d.estado === 'subido')).toBe(true))

    act(() => result.current.marcarAdjuntados(['pend-adjuntado']))
    unmount()

    expect(descartar).toHaveBeenCalledTimes(1)
    expect(descartar).toHaveBeenCalledWith('pend-suelto')
  })
})
