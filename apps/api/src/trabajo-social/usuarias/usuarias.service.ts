import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BuscarUsuariaQuery,
  EditarIdentidadUsuariaInput,
  UsuariaExpedienteHub,
  UsuariaResumenBusqueda,
} from '@akyuam/shared';
import type { MunicipioAltaVerapaz } from '@prisma/client';
import { AuditService } from '../../auth/services/audit.service';
import { USUARIAS_REPOSITORY } from './interfaces/usuarias-repository.interface';
import type {
  DatosIdentidadUsuariaParams,
  IUsuariasRepository,
} from './interfaces/usuarias-repository.interface';

const LONGITUD_MINIMA_BUSQUEDA_NOMBRE = 3;
const LIMITE_RESULTADOS_BUSQUEDA = 20;

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

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
const CAMPOS_IDENTIDAD: (keyof UsuariaExpedienteHub)[] = [
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
  anterior: UsuariaExpedienteHub,
  actualizado: UsuariaExpedienteHub,
): string[] {
  return CAMPOS_IDENTIDAD.filter(
    (campo) => anterior[campo] !== actualizado[campo],
  );
}

@Injectable()
export class UsuariasService {
  constructor(
    @Inject(USUARIAS_REPOSITORY)
    private readonly usuariasRepository: IUsuariasRepository,
    private readonly auditService: AuditService,
  ) {}

  async buscar(
    query: BuscarUsuariaQuery,
    contexto: ContextoAuditoria,
  ): Promise<UsuariaResumenBusqueda[]> {
    const dpi = query.dpi?.trim();
    const nombre = query.nombre?.trim();

    if (!dpi && !nombre) {
      throw new BadRequestException('Indica un DPI o un nombre para buscar');
    }
    if (nombre && nombre.length < LONGITUD_MINIMA_BUSQUEDA_NOMBRE) {
      throw new BadRequestException(
        `El nombre debe tener al menos ${LONGITUD_MINIMA_BUSQUEDA_NOMBRE} caracteres`,
      );
    }

    const resultados = dpi
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

    return hub;
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
      throw new ConflictException(
        'El DPI ya está registrado para otra usuaria',
      );
    }

    const actualizado = await this.usuariasRepository.actualizarIdentidad(
      id,
      mapearParametrosIdentidad(datos),
    );
    if (!actualizado) {
      throw new NotFoundException('Usuaria no encontrada');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'USUARIA_ACTUALIZADA',
      entidad: 'Usuaria',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { campos: camposCambiados(anterior, actualizado) },
    });

    return actualizado;
  }

  private async buscarPorDpiExacto(
    dpi: string,
  ): Promise<UsuariaResumenBusqueda[]> {
    const usuaria = await this.usuariasRepository.buscarPorDpi(dpi);
    return usuaria ? [usuaria] : [];
  }
}
