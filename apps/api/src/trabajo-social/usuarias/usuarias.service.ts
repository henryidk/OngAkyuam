import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  USUARIAS_POR_PAGINA,
  type BuscarUsuariaQuery,
  type EditarIdentidadUsuariaInput,
  type ExpedienteResumenCaso,
  type ListarUsuariasQuery,
  type ListaUsuariasTs,
  type UsuariaExpedienteHub,
  type UsuariaResumenBusqueda,
} from '@akyuam/shared';
import type { MunicipioAltaVerapaz } from '@prisma/client';
import { AREA_NOTIFIER } from '../../areas/interfaces/area-notifier.interface';
import type { IAreaNotifier } from '../../areas/interfaces/area-notifier.interface';
import { AuditService } from '../../auth/services/audit.service';
import {
  interpretarBusqueda,
  type BusquedaListaUsuarias,
} from '../../common/busqueda-usuarias';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { EstadoTsService } from '../estado/estado-ts.service';
import { DpiUsuariaDuplicadoError } from '../interfaces/expedientes-repository.interface';
import { USUARIAS_REPOSITORY } from './interfaces/usuarias-repository.interface';
import type {
  CasoHubRow,
  DatosIdentidadUsuariaParams,
  IUsuariasRepository,
  UsuariaHubRow,
} from './interfaces/usuarias-repository.interface';

const LONGITUD_MINIMA_BUSQUEDA_NOMBRE = 3;
const LIMITE_RESULTADOS_BUSQUEDA = 20;
const MENSAJE_DPI_DUPLICADO = 'El DPI ya está registrado para otra usuaria';

function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

function mapearParametrosIdentidad(
  datos: EditarIdentidadUsuariaInput,
): DatosIdentidadUsuariaParams {
  return {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    dpi: vacioANulo(datos.dpi),
    telefono: vacioANulo(datos.telefono),
    direccion: vacioANulo(datos.direccion),
    fechaNacimiento: datos.fechaNacimiento,
    grupoEtnico: datos.grupoEtnico,
    municipio: datos.fueraDeAltaVerapaz
      ? null
      : (datos.municipio as MunicipioAltaVerapaz),
    departamentoOtro: datos.fueraDeAltaVerapaz
      ? vacioANulo(datos.departamentoOtro)
      : null,
    municipioOtro: datos.fueraDeAltaVerapaz
      ? vacioANulo(datos.municipioOtro)
      : null,
    ubicacionGeografica: vacioANulo(datos.ubicacionGeografica),
  };
}

// Nombres de campos de identidad que puede tocar `actualizarIdentidad`, en el mismo orden en
// que se comparan para el detalle de auditoría — nunca sus valores (RNF-02).
const CAMPOS_IDENTIDAD: (keyof UsuariaHubRow)[] = [
  'nombres',
  'apellidos',
  'dpi',
  'telefono',
  'direccion',
  'fechaNacimiento',
  'grupoEtnico',
  'municipio',
  'departamentoOtro',
  'municipioOtro',
  'ubicacionGeografica',
];

function camposCambiados(
  anterior: UsuariaHubRow,
  actualizado: UsuariaHubRow,
): string[] {
  return CAMPOS_IDENTIDAD.filter(
    (campo) => anterior[campo] !== actualizado[campo],
  );
}

function resumirCaso(
  caso: CasoHubRow,
  estado: ExpedienteResumenCaso['estado'],
): ExpedienteResumenCaso {
  return {
    id: caso.id,
    numero: caso.numero,
    fecha: caso.fecha,
    tipoRegistro: caso.tipoRegistro,
    enAlbergue: caso.enAlbergue,
    areasReferidas: caso.referidos.map((referido) => referido.area),
    estado,
  };
}

@Injectable()
export class UsuariasService {
  constructor(
    @Inject(USUARIAS_REPOSITORY)
    private readonly usuariasRepository: IUsuariasRepository,
    private readonly auditService: AuditService,
    private readonly estadoTsService: EstadoTsService,
    @Inject(AREA_NOTIFIER)
    private readonly areaNotifier: IAreaNotifier,
  ) {}

  async listar(
    query: ListarUsuariasQuery,
    contexto: ContextoAuditoria,
  ): Promise<ListaUsuariasTs> {
    const busqueda = interpretarBusqueda(query.q);
    const lista = await this.usuariasRepository.listar({
      filtro: query.estado,
      busqueda,
      pagina: query.pagina,
      porPagina: USUARIAS_POR_PAGINA,
    });

    // Solo el tipo de búsqueda y el filtro — nunca el término escrito (RNF-02).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'USUARIAS_LISTADAS',
      entidad: 'Usuaria',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        filtro: query.estado ?? 'TODAS',
        busqueda: busqueda?.tipo ?? null,
        pagina: query.pagina,
        resultados: lista.filas.length,
      },
    });

    return lista;
  }

  async buscar(
    query: BuscarUsuariaQuery,
    contexto: ContextoAuditoria,
  ): Promise<UsuariaResumenBusqueda[]> {
    const q = query.q?.trim();
    const dpi = query.dpi?.trim();
    const nombre = query.nombre?.trim();

    if (!q && !dpi && !nombre) {
      throw new BadRequestException(
        'Indica un DPI, un nombre o un número de expediente para buscar',
      );
    }
    if (nombre && nombre.length < LONGITUD_MINIMA_BUSQUEDA_NOMBRE) {
      throw new BadRequestException(
        `El nombre debe tener al menos ${LONGITUD_MINIMA_BUSQUEDA_NOMBRE} caracteres`,
      );
    }

    // `q` es el término único del buscador global: se interpreta igual que en `listar` (número
    // de expediente, DPI exacto o nombre), y manda sobre `dpi`/`nombre` si viniera alguno también.
    const resultados = q
      ? await this.buscarPorCriterio(interpretarBusqueda(q)!)
      : dpi
        ? await this.buscarPorDpiExacto(dpi)
        : await this.usuariasRepository.buscarPorNombre(
            nombre as string,
            LIMITE_RESULTADOS_BUSQUEDA,
          );

    // Nunca el término buscado ni el DPI en `detalles` — solo cuántos resultados dio (RNF-02).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'USUARIA_BUSQUEDA',
      entidad: 'Usuaria',
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { resultados: resultados.length },
    });

    return resultados;
  }

  private async buscarPorCriterio(
    criterio: BusquedaListaUsuarias,
  ): Promise<UsuariaResumenBusqueda[]> {
    switch (criterio.tipo) {
      case 'dpi':
        return this.buscarPorDpiExacto(criterio.valor);
      case 'numeroExpediente':
        return this.usuariasRepository.buscarPorNumero(
          criterio.valor,
          LIMITE_RESULTADOS_BUSQUEDA,
        );
      case 'nombre':
        return this.usuariasRepository.buscarPorNombre(
          criterio.valor,
          LIMITE_RESULTADOS_BUSQUEDA,
        );
    }
  }

  async obtenerHub(
    id: string,
    contexto: ContextoAuditoria,
  ): Promise<UsuariaExpedienteHub> {
    const hub = await this.usuariasRepository.obtenerHub(id);
    if (!hub) {
      throw new NotFoundException('Usuaria no encontrada');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EXPEDIENTE_CONSULTADO',
      entidad: 'Usuaria',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { totalCasos: hub.casos.length },
    });

    return this.conEstado(hub);
  }

  async actualizarIdentidad(
    id: string,
    datos: EditarIdentidadUsuariaInput,
    contexto: ContextoAuditoria,
  ): Promise<UsuariaExpedienteHub> {
    const anterior = await this.usuariasRepository.obtenerHub(id);
    if (!anterior) {
      throw new NotFoundException('Usuaria no encontrada');
    }

    const dpi = vacioANulo(datos.dpi);
    if (dpi && (await this.usuariasRepository.existeDpi(dpi, id))) {
      throw new ConflictException(MENSAJE_DPI_DUPLICADO);
    }

    const actualizado = await this.guardarIdentidad(id, datos);
    if (!actualizado) {
      throw new NotFoundException('Usuaria no encontrada');
    }

    // Solo los nombres de los campos, nunca sus valores (RNF-02). Un cambio de DPI lleva su
    // propia acción: la bitácora lo destaca.
    const campos = camposCambiados(anterior, actualizado);
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: campos.includes('dpi')
        ? 'USUARIA_DPI_MODIFICADO'
        : 'USUARIA_ACTUALIZADA',
      entidad: 'Usuaria',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { campos },
    });

    if (campos.length > 0) {
      this.avisarAreasReferidas(actualizado);
    }

    return this.conEstado(actualizado);
  }

  private async guardarIdentidad(
    id: string,
    datos: EditarIdentidadUsuariaInput,
  ): Promise<UsuariaHubRow | null> {
    try {
      return await this.usuariasRepository.actualizarIdentidad(
        id,
        mapearParametrosIdentidad(datos),
      );
    } catch (error) {
      if (error instanceof DpiUsuariaDuplicadoError) {
        throw new ConflictException(MENSAJE_DPI_DUPLICADO);
      }
      throw error;
    }
  }

  /** Cada área referida en alguno de sus casos refresca la ficha si la tiene abierta. */
  private avisarAreasReferidas(usuaria: UsuariaHubRow): void {
    for (const caso of usuaria.casos) {
      for (const referido of caso.referidos) {
        this.areaNotifier.notificarUsuariaActualizada(referido.area, caso.id);
      }
    }
  }

  /** Agrega el estado derivado de cada caso y el detalle por área del caso activo. */
  private async conEstado(hub: UsuariaHubRow): Promise<UsuariaExpedienteHub> {
    const estados = await Promise.all(
      hub.casos.map((caso) =>
        this.estadoTsService.resolverCaso(
          caso.referidos.map((referido) => ({
            ...referido,
            expedienteId: caso.id,
          })),
        ),
      ),
    );
    const [casoActivo] = hub.casos;
    return {
      ...hub,
      casos: hub.casos.map((caso, indice) =>
        resumirCaso(caso, estados[indice].estado),
      ),
      casoActivo: casoActivo ? { id: casoActivo.id, ...estados[0] } : null,
    };
  }

  private async buscarPorDpiExacto(
    dpi: string,
  ): Promise<UsuariaResumenBusqueda[]> {
    const usuaria = await this.usuariasRepository.buscarPorDpi(dpi);
    return usuaria ? [usuaria] : [];
  }
}
