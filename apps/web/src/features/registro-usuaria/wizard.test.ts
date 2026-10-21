import { describe, expect, it } from 'vitest'
import { calcularEstadoPasos, construirPasos } from './wizard'

describe('construirPasos', () => {
  it('registra primero y deja referir y documentos para después', () => {
    expect(construirPasos(false, 'EXTERNA').map((paso) => paso.id)).toEqual([
      'usuaria',
      'situacion',
      'registro',
      'revision',
      'referir',
      'documentos',
    ])
  })

  it('omite la identidad si la usuaria ya existe y pide hijas/hijos solo en Interna', () => {
    expect(construirPasos(true, 'INTERNA').map((paso) => paso.id)).toEqual([
      'situacion',
      'registro',
      'hijos',
      'revision',
      'referir',
      'documentos',
    ])
  })
})

describe('calcularEstadoPasos', () => {
  const pasos = construirPasos(false, 'EXTERNA')

  it('antes de registrar se puede volver a cualquier paso anterior', () => {
    const estados = calcularEstadoPasos(pasos, 'revision')
    expect(estados.filter((estado) => estado.alcanzable).map((estado) => estado.paso.id)).toEqual([
      'usuaria',
      'situacion',
      'registro',
      'revision',
    ])
  })

  it('ya registrado, los pasos de datos quedan completados pero cerrados', () => {
    const estados = calcularEstadoPasos(pasos, 'documentos')
    expect(estados.filter((estado) => estado.alcanzable).map((estado) => estado.paso.id)).toEqual([
      'referir',
      'documentos',
    ])
    expect(estados.find((estado) => estado.paso.id === 'usuaria')).toMatchObject({ completado: true })
  })
})
