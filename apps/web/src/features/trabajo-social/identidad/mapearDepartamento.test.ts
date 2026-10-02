import { describe, expect, it } from 'vitest'
import { camposVisiblesModificados, mapearDepartamento } from './mapearDepartamento'

describe('mapearDepartamento', () => {
  it('Alta Verapaz: no es de fuera y limpia el departamento y municipio escritos a mano', () => {
    expect(mapearDepartamento('Alta Verapaz')).toEqual({
      fueraDeAltaVerapaz: false,
      departamentoOtro: '',
      municipioOtro: '',
    })
  })

  it('otro departamento: es de fuera, guarda el departamento y limpia el municipio de Alta Verapaz', () => {
    expect(mapearDepartamento('Izabal')).toEqual({
      fueraDeAltaVerapaz: true,
      departamentoOtro: 'Izabal',
      municipio: '',
    })
  })
})

describe('camposVisiblesModificados', () => {
  it('cuenta el departamento y el municipio una sola vez cada uno', () => {
    expect(
      camposVisiblesModificados({
        fueraDeAltaVerapaz: true,
        departamentoOtro: true,
        municipio: true,
        municipioOtro: true,
        telefono: true,
      }),
    ).toEqual(['telefono', 'departamento', 'municipio'])
  })

  it('sin campos sucios no hay cambios', () => {
    expect(camposVisiblesModificados({})).toEqual([])
  })
})
