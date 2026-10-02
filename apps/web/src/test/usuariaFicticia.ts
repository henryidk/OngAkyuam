import type { UsuariaExpedienteHub } from '@akyuam/shared'

/** Usuaria inventada para pruebas: ningún dato corresponde a una persona real. */
export function usuariaFicticia(cambios: Partial<UsuariaExpedienteHub> = {}): UsuariaExpedienteHub {
  return {
    id: 'usuaria-ficticia-1',
    createdAt: '2025-02-03T15:00:00.000Z',
    nombres: 'Persona',
    apellidos: 'De Prueba',
    dpi: '1000000000001',
    telefono: '00000000',
    direccion: null,
    fechaNacimiento: '1990-05-10',
    grupoEtnico: 'LADINO',
    municipio: 'COBAN',
    departamentoOtro: null,
    municipioOtro: null,
    ubicacionGeografica: 'Zona de prueba',
    casos: [],
    casoActivo: null,
    ...cambios,
  }
}
