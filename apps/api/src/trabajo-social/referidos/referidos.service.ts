import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AreaAtencion,
  ProfesionalArea,
  ReferidoCreado,
  ReferirInput,
} from '@akyuam/shared';
import { AREA_NOTIFIER } from '../../areas/interfaces/area-notifier.interface';
import type { IAreaNotifier } from '../../areas/interfaces/area-notifier.interface';
import { PoliticasAcceso } from '../../areas/politicas/politicas-acceso';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  AreaYaReferidaError,
  REFERIDOS_REPOSITORY,
} from './interfaces/referidos-repository.interface';
import type {
  IReferidosRepository,
  ReferidoRegistrado,
} from './interfaces/referidos-repository.interface';

const MENSAJE_AREA_YA_REFERIDA = new AreaYaReferidaError().message;

@Injectable()
export class ReferidosService {
  constructor(
    @Inject(REFERIDOS_REPOSITORY)
    private readonly referidosRepository: IReferidosRepository,
    @Inject(AREA_NOTIFIER)
    private readonly areaNotifier: IAreaNotifier,
    private readonly politicasAcceso: PoliticasAcceso,
    private readonly auditService: AuditService,
  ) {}

  async listarProfesionales(area: AreaAtencion): Promise<ProfesionalArea[]> {
    return this.referidosRepository.listarProfesionales(area);
  }

  async referir(
    expedienteId: string,
    datos: ReferirInput,
    contexto: ContextoAuditoria,
  ): Promise<ReferidoCreado> {
    const expediente =
      await this.referidosRepository.buscarExpediente(expedienteId);
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }
    // Chequeo previo para un mensaje claro; la restricción única de la BD sigue siendo la
    // garantía real ante dos referidos simultáneos (ver el catch de abajo).
    if (expediente.areasReferidas.includes(datos.area)) {
      throw new ConflictException(MENSAJE_AREA_YA_REFERIDA);
    }

    const profesionalAsignadoId = datos.profesionalAsignadoId ?? null;
    if (
      profesionalAsignadoId &&
      !(await this.referidosRepository.esProfesionalActivoDelArea(
        profesionalAsignadoId,
        datos.area,
      ))
    ) {
      throw new BadRequestException(
        'La profesional seleccionada no pertenece a esta área o no está activa',
      );
    }

    // Un área no restringible (Jurídico) ve todo por su política: no se guarda visibilidad
    // explícita que luego pudiera confundirse con una restricción.
    const restringible = this.politicasAcceso.para(datos.area).esRestringible();

    let referido: ReferidoRegistrado;
    try {
      referido = await this.referidosRepository.crear({
        expedienteId,
        area: datos.area,
        prioridad: datos.prioridad,
        motivo: datos.motivo || null,
        procesosSugeridos:
          datos.area === 'JURIDICO' ? datos.procesosSugeridos : [],
        profesionalAsignadoId,
        puedeVerDatosCaso: restringible ? datos.visibilidad.datosCaso : true,
        documentosVisibles: restringible ? datos.visibilidad.documentos : [],
        crearAtencionPsicologica:
          datos.area === 'PSICOLOGIA' && profesionalAsignadoId !== null,
        otorgadoPorId: contexto.usuarioId,
      });
    } catch (error) {
      if (error instanceof AreaYaReferidaError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    // Nunca el motivo en `detalles`: es texto libre y puede contener datos de la usuaria.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EXPEDIENTE_REFERIDO',
      entidad: 'Expediente',
      entidadId: expedienteId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { area: datos.area, prioridad: datos.prioridad },
    });

    this.areaNotifier.notificarReferido(datos.area, {
      id: expediente.id,
      numero: expediente.numero,
      fecha: expediente.fecha,
      municipio: expediente.municipio,
      tipoRegistro: expediente.tipoRegistro,
      usuariaNombreCompleto: expediente.usuariaNombreCompleto,
      prioridad: datos.prioridad,
    });

    return {
      id: referido.id,
      area: datos.area,
      prioridad: referido.prioridad,
      profesionalAsignadoId: referido.profesionalAsignadoId,
      createdAt: referido.createdAt.toISOString(),
    };
  }
}
