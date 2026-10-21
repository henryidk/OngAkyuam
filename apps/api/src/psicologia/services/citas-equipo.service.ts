import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  sumarDiasGT,
  type AsumirCitaPsicologicaInput,
  type CitasPsicologiaQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { avisarTraslape } from '../compartido/traslape';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { CitasEquipoRepository } from '../repositories/citas-equipo.repository';
import { CitasPsicologicasService } from './citas-psicologicas.service';

@Injectable()
export class CitasEquipoService {
  constructor(
    private readonly equipo: CitasEquipoRepository,
    private readonly citas: CitasPsicologicasService,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly audit: AuditService,
  ) {}

  listar(query: CitasPsicologiaQuery, usuarioId: string) {
    if (
      query.hasta < query.desde ||
      query.hasta > sumarDiasGT(query.desde, 366)
    ) {
      throw new BadRequestException(
        'Selecciona un rango válido de hasta un año',
      );
    }
    return this.equipo.listar(query, usuarioId);
  }

  async asumir(
    citaId: string,
    datos: AsumirCitaPsicologicaInput,
    contexto: ContextoAuditoria,
  ) {
    const cita = await this.citas.obtenerDetalleCita(
      citaId,
      contexto.usuarioId,
    );
    if (!cita.soloLectura) return cita; // Reintento tras una respuesta de red perdida.
    if (!cita.puedeAsumirAtencion)
      throw new ConflictException(
        'Esta cita ya tiene un registro o su proceso está cerrado. Consulta el historial sin modificarlo.',
      );
    await avisarTraslape(this.citasRepository, {
      psicologaId: contexto.usuarioId,
      fechaHora: new Date(cita.fechaHora),
      duracionMinutos: cita.duracionMinutos,
      excluirCitaId: citaId,
      confirmarTraslape: datos.confirmarTraslape,
    });
    if (!(await this.equipo.asumir(citaId, contexto.usuarioId, datos))) {
      throw new ConflictException(
        'La cita cambió mientras la revisabas o ya tiene un registro. Actualiza la página antes de continuar.',
      );
    }
    await this.audit.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_PSICOLOGICA_ATENCION_ASUMIDA',
        entidad: 'CitaPsicologica',
        entidadId: citaId,
        detalles: {
          procesoId: cita.procesoId,
          expedienteId: cita.expedienteId,
          profesionalAnteriorId: datos.profesionalCitaId,
          responsableProcesoId: datos.psicologaAsignadaId,
        },
      }),
    );
    return this.citas.obtenerDetalleCita(citaId, contexto.usuarioId);
  }
}
