import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  ConsultasMedicasPaginaDto,
  ConsultasPacienteMedicaQuery,
  ContextoConsultaMedicaDto,
  ContextoConsultaMedicaQuery,
} from '@akyuam/shared';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import {
  MENSAJE_CITA_NO_REGISTRABLE,
  MENSAJE_SIN_ACCESO_ATENCION,
  MENSAJE_SIN_REFERENCIA_PENDIENTE,
} from '../compartido/mensajes';
import {
  CONSULTAS_MEDICAS_REPOSITORY,
  type IConsultasMedicasRepository,
} from '../interfaces/consultas-medicas-repository.interface';

/** Lecturas de consultas: el contexto del formulario y la historia clínica de la paciente. */
@Injectable()
export class ConsultasMedicasService {
  constructor(
    @Inject(CONSULTAS_MEDICAS_REPOSITORY)
    private readonly consultasRepository: IConsultasMedicasRepository,
    private readonly acceso: AccesoMedicaService,
  ) {}

  async contexto(
    query: ContextoConsultaMedicaQuery,
  ): Promise<ContextoConsultaMedicaDto> {
    if (query.cita) {
      const cita = await this.acceso.exigirCita(query.cita);
      if (cita.estadoCita !== 'PROGRAMADA' || cita.consultaId !== null) {
        throw new ConflictException(MENSAJE_CITA_NO_REGISTRABLE);
      }
      return this.exigirContexto(
        this.consultasRepository.contexto(cita.atencionId, {
          id: cita.citaId,
          inicio: cita.inicio,
          ninoId: cita.ninoId,
        }),
      );
    }
    // Consulta excepcional sin cita: solo con una atención activa.
    await this.acceso.exigirUsuaria(query.usuaria!);
    const atencionId = await this.consultasRepository.atencionActivaDeUsuaria(
      query.usuaria!,
    );
    if (!atencionId) {
      throw new ConflictException(MENSAJE_SIN_REFERENCIA_PENDIENTE);
    }
    return this.exigirContexto(
      this.consultasRepository.contexto(atencionId, null),
    );
  }

  async historia(
    usuariaId: string,
    query: ConsultasPacienteMedicaQuery,
  ): Promise<ConsultasMedicasPaginaDto> {
    await this.acceso.exigirUsuaria(usuariaId);
    const persona =
      query.persona === undefined
        ? undefined
        : query.persona === 'usuaria'
          ? null
          : query.persona;
    return this.consultasRepository.listarPorUsuaria(
      usuariaId,
      persona,
      query.cursor,
    );
  }

  private async exigirContexto(
    busqueda: Promise<ContextoConsultaMedicaDto | null>,
  ): Promise<ContextoConsultaMedicaDto> {
    const contexto = await busqueda;
    if (!contexto) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_ATENCION);
    }
    return contexto;
  }
}
