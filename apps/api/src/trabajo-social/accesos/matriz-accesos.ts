import {
  AREAS_MATRIZ_ACCESOS,
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO_TRABAJO_SOCIAL,
  tipoDocumentoAplicaARegistro,
  type AreaAtencion,
  type CeldaAcceso,
  type ColumnaMatrizAccesos,
  type FilaMatrizAccesos,
  type MatrizAccesos,
} from '@akyuam/shared';
import type { PoliticasAcceso } from '../../areas/politicas/politicas-acceso';
import type {
  DocumentoParaAccesos,
  ExpedienteParaAccesos,
  ReferidoParaAccesos,
} from './interfaces/accesos-repository.interface';

const CELDA_NO_REFERIDA: CeldaAcceso = {
  visible: false,
  bloqueado: false,
  deshabilitado: true,
};

function referidoDe(
  expediente: ExpedienteParaAccesos,
  area: AreaAtencion,
): ReferidoParaAccesos | undefined {
  return expediente.referidos.find((referido) => referido.area === area);
}

/**
 * Matriz "qué puede ver cada área": una fila para agresor/tipología/observaciones y una por
 * formulario de Trabajo Social que aplica al registro. Las celdas salen de la misma política
 * que aplica `AreasService`, para que la pantalla muestre exactamente lo que el área recibe.
 */
export function construirMatrizAccesos(
  expediente: ExpedienteParaAccesos,
  politicas: PoliticasAcceso,
): MatrizAccesos {
  const columnas: ColumnaMatrizAccesos[] = AREAS_MATRIZ_ACCESOS.map((area) => ({
    area,
    referida: referidoDe(expediente, area) !== undefined,
    restringible: politicas.para(area).esRestringible(),
  }));

  const celdas = (
    calcular: (
      area: AreaAtencion,
      referido: ReferidoParaAccesos,
    ) => CeldaAcceso,
  ) =>
    Object.fromEntries(
      AREAS_MATRIZ_ACCESOS.map((area) => {
        const referido = referidoDe(expediente, area);
        return [area, referido ? calcular(area, referido) : CELDA_NO_REFERIDA];
      }),
    ) as Record<AreaAtencion, CeldaAcceso>;

  const filaDatosCaso: FilaMatrizAccesos = {
    clave: 'DATOS_CASO',
    etiqueta: 'Agresor, tipología y observaciones',
    descripcion: 'Datos del caso',
    celdas: celdas((area, referido) => {
      const politica = politicas.para(area);
      return {
        visible: politica.puedeVerDatosCaso(referido),
        bloqueado: !politica.esRestringible(),
        deshabilitado: false,
      };
    }),
  };

  const filasDocumentos = TIPOS_DOCUMENTO_TRABAJO_SOCIAL.filter((tipo) =>
    tipoDocumentoAplicaARegistro(tipo, expediente.tipoRegistro),
  ).map((tipo): FilaMatrizAccesos => {
    const documento: DocumentoParaAccesos | undefined =
      expediente.documentos.find((vigente) => vigente.tipo === tipo);
    return {
      clave: tipo,
      etiqueta: ETIQUETAS_TIPO_DOCUMENTO[tipo],
      descripcion: documento
        ? `Subido · v${documento.version}`
        : 'Aún no se ha subido',
      celdas: celdas((area) => {
        const politica = politicas.para(area);
        if (!documento) {
          return { visible: false, bloqueado: false, deshabilitado: true };
        }
        return {
          visible: politica.puedeVerDocumento(documento),
          bloqueado: !politica.esRestringible(),
          deshabilitado: false,
        };
      }),
    };
  });

  return {
    expedienteId: expediente.id,
    numero: expediente.numero,
    columnas,
    filas: [filaDatosCaso, ...filasDocumentos],
  };
}
