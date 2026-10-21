import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentoSubido, MatrizAccesos } from '@akyuam/shared'
import {
  actualizarAccesoArea,
  subirDocumentoCaso,
  subirVersionDocumento,
} from '../../trabajo-social/api/trabajoSocial.api'
import { useDocumentosNuevoCaso } from './useDocumentosNuevoCaso'

vi.mock('../../trabajo-social/api/trabajoSocial.api', () => ({
  subirDocumentoCaso: vi.fn(),
  subirVersionDocumento: vi.fn(),
  actualizarAccesoArea: vi.fn(),
}))

const subir = vi.mocked(subirDocumentoCaso)
const subirVersion = vi.mocked(subirVersionDocumento)
const actualizarAcceso = vi.mocked(actualizarAccesoArea)

const EXPEDIENTE = 'exp-1'

function archivoFicticio(nombre = 'entrevista-ficticia.pdf', tipo = 'application/pdf') {
  return new File(['contenido'], nombre, { type: tipo })
}

function subidoFicticio(id: string): DocumentoSubido {
  return {
    id,
    tipo: 'ENTREVISTA_USUARIA',
    nombreArchivo: 'entrevista-ficticia.pdf',
    tamanioBytes: 9,
    createdAt: '2026-10-21T15:00:00.000Z',
  }
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

describe('useDocumentosNuevoCaso', () => {
  beforeEach(() => {
    subir.mockReset()
    subirVersion.mockReset()
    actualizarAcceso.mockReset()
    actualizarAcceso.mockResolvedValue({} as MatrizAccesos)
  })

  it('sube directo al caso, privado por defecto, y muestra el progreso', async () => {
    const subida = diferida<DocumentoSubido>()
    let reportarProgreso: (porcentaje: number) => void = () => {}
    subir.mockImplementation((_expediente, _tipo, _archivo, opciones) => {
      reportarProgreso = opciones?.onProgreso ?? (() => {})
      return subida.promesa
    })
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    expect(subir).toHaveBeenCalledWith(
      EXPEDIENTE,
      'ENTREVISTA_USUARIA',
      expect.any(File),
      expect.objectContaining({ areasVisibles: [] }),
    )
    expect(result.current.haySubidasEnCurso).toBe(true)

    act(() => reportarProgreso(40))
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subiendo', progreso: 40 })

    await act(async () => subida.resolver(subidoFicticio('doc-1')))
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subido', documentoId: 'doc-1' })
    expect(result.current.subidos).toEqual(['ENTREVISTA_USUARIA'])
    expect(result.current.haySubidasEnCurso).toBe(false)
  })

  it('antes de subir, compartir con un área solo se recuerda y viaja junto con el archivo', async () => {
    subir.mockResolvedValue(subidoFicticio('doc-1'))
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))

    await act(async () => result.current.alternarVisibilidad('ENTREVISTA_USUARIA', 'PSICOLOGIA', true))
    expect(actualizarAcceso).not.toHaveBeenCalled()

    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    expect(subir).toHaveBeenCalledWith(
      EXPEDIENTE,
      'ENTREVISTA_USUARIA',
      expect.any(File),
      expect.objectContaining({ areasVisibles: ['PSICOLOGIA'] }),
    )
  })

  it('ya subido, cada cambio de visibilidad se guarda en el momento', async () => {
    subir.mockResolvedValue(subidoFicticio('doc-1'))
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))
    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))

    await act(async () => result.current.alternarVisibilidad('ENTREVISTA_USUARIA', 'MEDICA', true))
    expect(actualizarAcceso).toHaveBeenCalledWith(EXPEDIENTE, 'MEDICA', { documentos: { ENTREVISTA_USUARIA: true } })
    expect(result.current.visibilidad.ENTREVISTA_USUARIA).toEqual(['MEDICA'])
  })

  it('si guardar la visibilidad falla, vuelve a como estaba y avisa', async () => {
    subir.mockResolvedValue(subidoFicticio('doc-1'))
    actualizarAcceso.mockRejectedValue(new Error('sin conexión'))
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))
    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))

    await act(async () => result.current.alternarVisibilidad('ENTREVISTA_USUARIA', 'MEDICA', true))
    expect(result.current.visibilidad.ENTREVISTA_USUARIA).toEqual([])
    expect(result.current.errorVisibilidad).not.toBeNull()
  })

  it('reemplazar un documento ya subido sube una versión nueva del mismo documento', async () => {
    subir.mockResolvedValue(subidoFicticio('doc-1'))
    subirVersion.mockResolvedValue(subidoFicticio('version-2'))
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))
    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))

    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio('otra.pdf')))
    expect(subir).toHaveBeenCalledTimes(1)
    expect(subirVersion).toHaveBeenCalledWith(EXPEDIENTE, 'doc-1', expect.any(File))
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subido', documentoId: 'doc-1' })
  })

  it('un archivo no permitido no se sube y pide elegir otro', () => {
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))

    act(() => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio('nota.txt', 'text/plain')))
    expect(subir).not.toHaveBeenCalled()
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'error', reintentable: false })
  })

  it('si la subida falla se puede reintentar con el mismo archivo', async () => {
    subir.mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce(subidoFicticio('doc-1'))
    const { result } = renderHook(() => useDocumentosNuevoCaso(EXPEDIENTE))

    await act(async () => result.current.seleccionarArchivo('ENTREVISTA_USUARIA', archivoFicticio()))
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'error', reintentable: true })

    await act(async () => result.current.reintentar('ENTREVISTA_USUARIA'))
    expect(subir).toHaveBeenCalledTimes(2)
    expect(result.current.documentos.ENTREVISTA_USUARIA).toMatchObject({ estado: 'subido', documentoId: 'doc-1' })
  })
})
