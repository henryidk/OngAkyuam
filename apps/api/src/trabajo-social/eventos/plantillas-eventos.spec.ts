import {
  ACCIONES_BITACORA,
  ACCIONES_NOVEDAD_AREA,
  describirEvento,
} from './plantillas-eventos';

describe('plantillas de eventos', () => {
  it('arma el texto con las etiquetas del catálogo', () => {
    expect(
      describirEvento('EXPEDIENTE_REFERIDO', {
        area: 'PSICOLOGIA',
        prioridad: 'URGENTE',
      }),
    ).toEqual({
      area: null,
      destacado: true,
      texto: 'Refirió el caso al área psicológica',
    });
    expect(
      describirEvento('DOCUMENTO_VERSION_SUBIDA', {
        tipo: 'CONVENIO_INGRESO',
        version: 2,
      })?.texto,
    ).toBe('Subió la versión 2 de «Convenio de ingreso»');
  });

  it('no inventa texto con detalles inesperados', () => {
    expect(
      describirEvento('PROCESOS_JURIDICOS_CREADOS_LOTE', null)?.texto,
    ).toBe('Jurídico registró procesos');
    expect(
      describirEvento('DOCUMENTO_SUBIDO', { tipo: 'NO_EXISTE' })?.texto,
    ).toBe('Subió un documento');
  });

  it('ignora acciones fuera de la lista blanca (lecturas, notas clínicas)', () => {
    for (const accion of [
      'EXPEDIENTE_CONSULTADO',
      'DOCUMENTO_DESCARGADO',
      'REGISTRO_CONSULTA_GUARDADO',
      'DOCUMENTO_CITA_PSICOLOGICA_SUBIDO',
      'NOTA_AVANCE_AGREGADA',
    ]) {
      expect(describirEvento(accion, {})).toBeNull();
      expect(ACCIONES_BITACORA).not.toContain(accion);
    }
  });

  it('las novedades son solo acciones de un área', () => {
    expect(ACCIONES_NOVEDAD_AREA).toContain('PROCESOS_JURIDICOS_CREADOS_LOTE');
    expect(ACCIONES_NOVEDAD_AREA).toContain('ATENCION_PSICOLOGICA_TOMADA');
    expect(ACCIONES_NOVEDAD_AREA).not.toContain('EXPEDIENTE_REFERIDO');
    expect(ACCIONES_NOVEDAD_AREA).not.toContain('USUARIA_ACTUALIZADA');
  });

  it('describe el cambio de datos personales con etiquetas de campo, sin repetirlas', () => {
    expect(
      describirEvento('USUARIA_ACTUALIZADA', {
        campos: ['telefono', 'municipio', 'municipioOtro'],
      }),
    ).toEqual({
      area: null,
      destacado: false,
      texto: 'Datos de la usuaria actualizados (teléfono, municipio)',
    });
  });

  it('destaca el cambio de DPI', () => {
    expect(
      describirEvento('USUARIA_DPI_MODIFICADO', {
        campos: ['dpi', 'telefono'],
      }),
    ).toEqual({
      area: null,
      destacado: true,
      texto: 'Datos de la usuaria actualizados (DPI, teléfono)',
    });
  });
});
