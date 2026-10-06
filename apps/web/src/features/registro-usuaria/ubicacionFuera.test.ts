import { describe, expect, it } from 'vitest'
import { identidadUsuariaSchema, MUNICIPIOS_POR_DEPARTAMENTO, type IdentidadUsuaria } from '@akyuam/shared'

/** Datos ficticios: solo varía la ubicación entre casos. */
function identidad(ubicacion: Partial<IdentidadUsuaria>): IdentidadUsuaria {
  return {
    nombres: 'Ana',
    apellidos: 'Ficticia',
    dpi: '',
    telefono: '',
    direccion: '',
    fechaNacimiento: '2015-01-01',
    grupoEtnico: 'LADINO',
    fueraDeAltaVerapaz: true,
    municipio: '',
    departamentoOtro: 'Petén',
    municipioOtro: 'Sayaxché',
    ubicacionGeografica: 'Barrio ficticio',
    ...ubicacion,
  }
}

function erroresDe(datos: IdentidadUsuaria) {
  const resultado = identidadUsuariaSchema.safeParse(datos)
  return resultado.success ? [] : resultado.error.issues.map((issue) => ({ campo: issue.path[0], mensaje: issue.message }))
}

describe('ubicación de una usuaria de fuera de Alta Verapaz', () => {
  it('el catálogo tiene los 323 municipios fuera de Alta Verapaz y ninguno repetido por departamento', () => {
    const listas = Object.values(MUNICIPIOS_POR_DEPARTAMENTO)
    expect(listas.flat()).toHaveLength(323)
    for (const lista of listas) expect(new Set(lista).size).toBe(lista.length)
    expect(Object.keys(MUNICIPIOS_POR_DEPARTAMENTO)).not.toContain('Alta Verapaz')
  })

  it('acepta un municipio de la lista del departamento', () => {
    expect(erroresDe(identidad({}))).toEqual([])
  })

  it('acepta un municipio escrito a mano que no está en la lista', () => {
    expect(erroresDe(identidad({ municipioOtro: 'Municipio Nuevo' }))).toEqual([])
  })

  it('rechaza un departamento fuera del catálogo (o Alta Verapaz)', () => {
    expect(erroresDe(identidad({ departamentoOtro: 'Alta Verapaz' }))).toEqual([
      { campo: 'departamentoOtro', mensaje: 'Selecciona el departamento' },
    ])
  })

  it('rechaza el municipio vacío o en blanco', () => {
    expect(erroresDe(identidad({ municipioOtro: '   ' }))[0]?.campo).toBe('municipioOtro')
  })

  it('rechaza una escritura distinta de un municipio que sí está en la lista', () => {
    expect(erroresDe(identidad({ municipioOtro: 'sayaxche' }))).toEqual([
      { campo: 'municipioOtro', mensaje: 'Sayaxché ya está en la lista de Petén: elígelo ahí en lugar de escribirlo.' },
    ])
  })

  it('un municipio de otro departamento cuenta como escrito a mano', () => {
    // "Mixco" es de Guatemala: en Petén cuenta como escrito a mano, no como error.
    expect(erroresDe(identidad({ municipioOtro: 'Mixco' }))).toEqual([])
  })

  it('rechaza espacios de más', () => {
    expect(erroresDe(identidad({ municipioOtro: 'Municipio  Nuevo' }))[0]?.campo).toBe('municipioOtro')
  })

  it('en Alta Verapaz ignora los campos de fuera y exige un municipio del catálogo', () => {
    expect(
      erroresDe(identidad({ fueraDeAltaVerapaz: false, municipio: 'COBAN', departamentoOtro: '', municipioOtro: '' })),
    ).toEqual([])
    expect(erroresDe(identidad({ fueraDeAltaVerapaz: false, municipio: '' }))).toEqual([
      { campo: 'municipio', mensaje: 'Selecciona un municipio' },
    ])
  })
})
