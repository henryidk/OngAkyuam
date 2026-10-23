/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  ConsultaMedicaDto,
  HistorialConsultasMedicaPaginaDto,
} from '@akyuam/shared';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { AccesoConsultaMedica } from '../interfaces/acceso-medica-repository.interface';
import type { IHistorialConsultasRepository } from '../interfaces/historial-consultas-repository.interface';
import { HistorialConsultasService } from './historial-consultas.service';

const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
const ACCESO = {
  consultaId: 'con-1',
  expedienteId: 'exp-1',
  atencionId: 'a-1',
} as AccesoConsultaMedica;
const CONSULTA = { id: 'con-1' } as ConsultaMedicaDto;
const PAGINA: HistorialConsultasMedicaPaginaDto = {
  items: [{ id: 'con-1' } as HistorialConsultasMedicaPaginaDto['items'][0]],
  siguienteCursor: null,
};

describe('HistorialConsultasService', () => {
  let repository: jest.Mocked<IHistorialConsultasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let audit: jest.Mocked<AuditService>;
  let service: HistorialConsultasService;

  beforeEach(() => {
    repository = {
      listar: jest.fn().mockResolvedValue(PAGINA),
      detalle: jest.fn().mockResolvedValue(CONSULTA),
    };
    acceso = {
      exigirConsulta: jest.fn().mockResolvedValue(ACCESO),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    audit = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new HistorialConsultasService(repository, acceso, audit);
  });

  describe('buscar', () => {
    it('convierte el rango de calendario a instantes de Guatemala, con "hasta" inclusivo', async () => {
      await service.buscar(
        { desde: '2026-10-01', hasta: '2026-10-14' },
        CONTEXTO,
      );
      expect(repository.listar).toHaveBeenCalledWith({
        desde: new Date('2026-10-01T06:00:00.000Z'),
        hasta: new Date('2026-10-15T06:00:00.000Z'),
        busqueda: undefined,
        cursor: undefined,
      });
    });

    it('audita la búsqueda sin guardar nunca el texto buscado', async () => {
      await service.buscar(
        { desde: '2026-10-01', hasta: '2026-10-14', q: 'María López' },
        CONTEXTO,
      );
      const [evento] = audit.registrar.mock.calls[0];
      expect(evento.accion).toBe('HISTORIAL_CONSULTAS_MEDICAS_CONSULTADO');
      expect(evento.detalles).toEqual({
        desde: '2026-10-01',
        hasta: '2026-10-14',
        conBusqueda: true,
        pagina: 'primera',
        resultados: 1,
      });
      expect(JSON.stringify(evento)).not.toContain('María');
    });

    it('un nombre demasiado corto es 400 y no consulta la base', async () => {
      await expect(
        service.buscar(
          { desde: '2026-10-01', hasta: '2026-10-14', q: 'Al' },
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.listar).not.toHaveBeenCalled();
    });

    it('si la auditoría falla no devuelve la página', async () => {
      audit.registrar.mockRejectedValue(new Error('audit caído'));
      await expect(
        service.buscar({ desde: '2026-10-01', hasta: '2026-10-14' }, CONTEXTO),
      ).rejects.toThrow('audit caído');
    });
  });

  describe('detalle', () => {
    it('exige acceso a la consulta y audita la apertura antes de devolverla', async () => {
      await expect(service.detalle('con-1', CONTEXTO)).resolves.toBe(CONSULTA);
      expect(acceso.exigirConsulta).toHaveBeenCalledWith('con-1');
      const [evento] = audit.registrar.mock.calls[0];
      expect(evento).toMatchObject({
        accion: 'CONSULTA_MEDICA_VISTA',
        entidad: 'ConsultaMedica',
        entidadId: 'con-1',
        detalles: { expedienteId: 'exp-1', atencionId: 'a-1' },
      });
    });

    it('sin acceso no lee la consulta ni la registra como vista', async () => {
      acceso.exigirConsulta.mockRejectedValue(new ForbiddenException());
      await expect(service.detalle('con-1', CONTEXTO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.detalle).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('si el repositorio no la encuentra responde el mismo 403', async () => {
      repository.detalle.mockResolvedValue(null);
      await expect(service.detalle('con-1', CONTEXTO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('si la auditoría falla no entrega el contenido clínico', async () => {
      audit.registrar.mockRejectedValue(new Error('audit caído'));
      await expect(service.detalle('con-1', CONTEXTO)).rejects.toThrow(
        'audit caído',
      );
    });
  });
});
