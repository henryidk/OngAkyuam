import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import type {
  ConsultaMedicaDto,
  ConsultasMedicasPaginaDto,
  FichaPacienteMedicaDto,
  HistorialConsultasMedicaPaginaDto,
  PacienteBuscadaMedicaDto,
  VistaMedicaParaJuridico,
} from '@akyuam/shared';
import {
  diaSemanaGT,
  hoyGT,
  limiteAgendaMedica,
  sumarDiasGT,
} from '@akyuam/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  MARCA,
  crearApp,
  crearAtencionConConsulta,
  crearExpediente,
  crearNino,
  crearUsuario,
  inicioCitaMedicaLibre,
  sesionDe,
  type Sesion,
} from './fixtures';

type Metodo = 'get' | 'post' | 'patch' | 'delete';

const ID = randomUUID();
// Todos los endpoints del módulo. Con otro rol, el RolesGuard responde 403 antes de leer
// parámetros o cuerpo, así que basta un id cualquiera.
const ENDPOINTS: [Metodo, string][] = [
  ['get', '/api/medica/bandeja'],
  ['get', '/api/medica/contadores'],
  ['get', '/api/medica/agenda'],
  ['get', '/api/medica/agenda/dia'],
  ['get', '/api/medica/agenda/disponibilidad'],
  ['get', '/api/medica/agenda/programables'],
  ['post', '/api/medica/agenda/programables/busqueda'],
  ['get', '/api/medica/pacientes'],
  ['get', `/api/medica/pacientes/${ID}`],
  ['get', `/api/medica/pacientes/${ID}/consultas`],
  ['get', `/api/medica/pacientes/${ID}/documentos`],
  ['get', '/api/medica/reportes'],
  ['get', '/api/medica/reportes/excel'],
  ['get', '/api/medica/consultas/contexto'],
  ['get', '/api/medica/consultas/por-atender'],
  ['post', '/api/medica/consultas/historial/busqueda'],
  ['get', `/api/medica/consultas/${ID}`],
  ['get', `/api/medica/documentos/${ID}/url`],
  ['post', '/api/medica/citas'],
  ['post', `/api/medica/citas/${ID}/inasistencia`],
  ['post', `/api/medica/citas/${ID}/reprogramacion`],
  ['post', '/api/medica/consultas'],
  ['post', `/api/medica/consultas/${ID}/documentos`],
  ['post', '/api/medica/documentos/pendientes'],
  ['delete', `/api/medica/documentos/pendientes/${ID}`],
  ['post', `/api/medica/atenciones/${ID}/alta`],
  ['patch', `/api/medica/atenciones/${ID}/visibilidad`],
];
const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'JURIDICO',
  'PSICOLOGIA',
  'ADMINISTRACION',
];
const DATOS_CLINICOS = [
  'diagnostico',
  'planTratamiento',
  'recetaLaboratorios',
  'motivoConsulta',
  `${MARCA} diagnóstico`,
  `${MARCA} plan`,
  `${MARCA} receta`,
  `${MARCA} motivo`,
];

const SIN_SIGNOS = {
  presionSistolica: null,
  presionDiastolica: null,
  frecuenciaCardiaca: null,
  frecuenciaResp: null,
  temperaturaC: null,
  saturacionO2: null,
  glucosaMgDl: null,
  pesoKg: null,
  tallaM: null,
};

describe('Medicina · acceso (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let medica: Usuario;
  let sesionMedica: Sesion;
  const sesiones = new Map<Rol, Sesion>();

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medica = await crearUsuario(prisma, 'MEDICA');
    sesionMedica = sesionDe(app, medica);
    for (const rol of OTROS_ROLES) {
      sesiones.set(rol, sesionDe(app, await crearUsuario(prisma, rol)));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(metodo: Metodo, ruta: string, sesion: Sesion) {
    return request(app.getHttpServer())
      [metodo](ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  describe('otro rol', () => {
    it.each(
      OTROS_ROLES.flatMap((rol) =>
        ENDPOINTS.map(([metodo, ruta]) => [rol, metodo, ruta] as const),
      ),
    )('%s → %s %s responde 403', async (rol, metodo, ruta) => {
      await pedir(metodo, ruta, sesiones.get(rol)!).expect(403);
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer()).get('/api/medica/bandeja').expect(401);
    });
  });

  describe('controles: con el acceso correcto sí responde', () => {
    it('la médica ve la ficha de una usuaria referida a Medicina', async () => {
      const { usuaria } = await crearExpediente(prisma, medica.id, ['MEDICA']);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}`,
        sesionMedica,
      ).expect(200);
    });

    it('Jurídico firma un documento de la atención compartida de su propia usuaria', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
        { visibleJuridico: true },
      );
      await pedir(
        'get',
        `/api/juridico/usuarias/${usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(200);
    });
  });

  describe('expediente no referido a Medicina', () => {
    it('no se ve la ficha de la usuaria ni se le programa cita', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}`,
        sesionMedica,
      ).expect(403);
      await pedir('post', '/api/medica/citas', sesionMedica)
        .send({
          expedienteId: expediente.id,
          personas: [null],
          duracionMin: 30,
          inicio: '2099-01-05T09:00',
        })
        .expect(403);
      expect(
        await prisma.atencionMedica.count({
          where: { expedienteId: expediente.id },
        }),
      ).toBe(0);
    });

    it('la referencia de otra área no sirve para abrir una atención', async () => {
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'PSICOLOGIA',
      ]);
      await pedir('post', '/api/medica/citas', sesionMedica)
        .send({
          referidoId: expediente.referidos[0].id,
          personas: [null],
          duracionMin: 30,
          inicio: '2099-01-05T09:00',
        })
        .expect(403);
    });
  });

  describe('personas de la visita', () => {
    async function expedienteConHijos() {
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      const hijo = await crearNino(prisma, expediente.id);
      const hija = await crearNino(prisma, expediente.id);
      return { expediente, hijo, hija };
    }

    /** Programa en una hora libre (salvo que `datos` traiga su `inicio`) y exige `estado`. */
    async function programar(datos: object, estado: number) {
      return pedir('post', '/api/medica/citas', sesionMedica)
        .send({
          duracionMin: 60,
          inicio: await inicioCitaMedicaLibre(prisma),
          ...datos,
        })
        .expect(estado);
    }

    it('no programa a más de un mes y no abre la atención', async () => {
      const { expediente } = await expedienteConHijos();
      let dia = sumarDiasGT(limiteAgendaMedica(hoyGT()), 1);
      while (diaSemanaGT(dia) > 5) {
        dia = sumarDiasGT(dia, 1);
      }
      const respuesta = await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null],
          duracionMin: 30,
          inicio: `${dia}T09:00`,
        },
        400,
      );
      expect(JSON.stringify(respuesta.body)).toContain('un mes adelante');
      expect(
        await prisma.atencionMedica.count({
          where: { expedienteId: expediente.id },
        }),
      ).toBe(0);
    });

    it('la primera consulta sin todos los hijos/as responde 409 y no abre la atención', async () => {
      const { expediente, hijo } = await expedienteConHijos();
      const respuesta = await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null, hijo.id],
        },
        409,
      );
      expect(respuesta.body).toEqual(
        expect.objectContaining({ codigo: 'PERSONAS_PRIMERA_CONSULTA' }),
      );
      expect(
        await prisma.atencionMedica.count({
          where: { expedienteId: expediente.id },
        }),
      ).toBe(0);
    });

    it('la primera consulta sin la usuaria también responde 409', async () => {
      const { expediente, hijo, hija } = await expedienteConHijos();
      await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [hijo.id, hija.id],
        },
        409,
      );
    });

    it('con la usuaria y todos sus hijos/as abre la atención con una persona por fila', async () => {
      const { expediente, hijo, hija } = await expedienteConHijos();
      const respuesta = await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null, hijo.id, hija.id],
        },
        201,
      );
      const { citaId } = respuesta.body as { citaId: string };
      const personas = await prisma.citaMedicaPersona.findMany({
        where: { citaId },
        select: { ninoId: true },
      });
      expect(personas.map((p) => p.ninoId).sort()).toEqual(
        [null, hijo.id, hija.id].sort(),
      );
    });

    it('en las siguientes citas cada hijo/a es opcional, también una cita solo de hijos/as', async () => {
      const { expediente, hijo, hija } = await expedienteConHijos();
      await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null, hijo.id, hija.id],
        },
        201,
      );
      await programar(
        {
          expedienteId: expediente.id,
          personas: [null],
        },
        201,
      );
      await programar(
        {
          expedienteId: expediente.id,
          personas: [hija.id],
        },
        201,
      );
    });

    it('un hijo/a de otro expediente responde 400 y no se agenda', async () => {
      const { expediente, hijo, hija } = await expedienteConHijos();
      const { expediente: otro } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      const ajeno = await crearNino(prisma, otro.id);
      await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null, hijo.id, hija.id, ajeno.id],
        },
        400,
      );
      expect(
        await prisma.citaMedicaPersona.count({ where: { ninoId: ajeno.id } }),
      ).toBe(0);
    });

    describe('registrar la visita', () => {
      function registro(ninoId: string | null) {
        return {
          ninoId,
          motivoConsulta: null,
          signos: SIN_SIGNOS,
          diagnostico: `${MARCA} diagnóstico`,
          planTratamiento: null,
          recetaLaboratorios: null,
          loteDocumentos: null,
        };
      }

      async function visitaProgramada() {
        const { expediente, hijo, hija } = await expedienteConHijos();
        const respuesta = await programar(
          {
            referidoId: expediente.referidos[0].id,
            personas: [null, hijo.id, hija.id],
          },
          201,
        );
        const { citaId, atencionId } = respuesta.body as {
          citaId: string;
          atencionId: string;
        };
        return { citaId, atencionId, hijo, hija, expediente };
      }

      function registrar(datos: object) {
        return pedir('post', '/api/medica/consultas', sesionMedica).send({
          proxima: null,
          ...datos,
        });
      }

      it('si falta una persona responde 400 y no guarda ninguna consulta', async () => {
        const { citaId, atencionId, hijo } = await visitaProgramada();
        await registrar({
          citaId,
          atencionId,
          registros: [registro(null), registro(hijo.id)],
        }).expect(400);
        expect(await prisma.consultaMedica.count({ where: { citaId } })).toBe(
          0,
        );
      });

      it('con todas las personas crea una consulta por persona y la próxima con lo elegido', async () => {
        const { citaId, atencionId, hijo, hija } = await visitaProgramada();
        const respuesta = await registrar({
          citaId,
          atencionId,
          registros: [registro(null), registro(hijo.id), registro(hija.id)],
          proxima: {
            inicio: await inicioCitaMedicaLibre(prisma),
            duracionMin: 90,
            personas: [hijo.id],
          },
        }).expect(201);
        const cuerpo = respuesta.body as {
          consultas: { ninoId: string | null }[];
          proximaCita: { citaId: string };
        };
        expect(cuerpo.consultas.map((c) => c.ninoId)).toEqual([
          null,
          hijo.id,
          hija.id,
        ]);
        expect(await prisma.consultaMedica.count({ where: { citaId } })).toBe(
          3,
        );
        const cita = await prisma.citaMedica.findUniqueOrThrow({
          where: { id: citaId },
          select: { estado: true },
        });
        expect(cita.estado).toBe('ATENDIDA');
        const siguiente = await prisma.citaMedica.findUniqueOrThrow({
          where: { id: cuerpo.proximaCita.citaId },
          select: { duracionMin: true, personas: { select: { ninoId: true } } },
        });
        expect(siguiente.duracionMin).toBe(90);
        expect(siguiente.personas.map((p) => p.ninoId)).toEqual([hijo.id]);
      });

      it('una próxima con un hijo/a de otro expediente responde 400 y no guarda nada', async () => {
        const { citaId, atencionId, hijo, hija } = await visitaProgramada();
        const { expediente: otro } = await crearExpediente(prisma, medica.id, [
          'MEDICA',
        ]);
        const ajeno = await crearNino(prisma, otro.id);
        await registrar({
          citaId,
          atencionId,
          registros: [registro(null), registro(hijo.id), registro(hija.id)],
          proxima: {
            inicio: await inicioCitaMedicaLibre(prisma),
            duracionMin: 30,
            personas: [null, ajeno.id],
          },
        }).expect(400);
        expect(await prisma.consultaMedica.count({ where: { citaId } })).toBe(
          0,
        );
        expect(
          await prisma.citaMedicaPersona.count({ where: { ninoId: ajeno.id } }),
        ).toBe(0);
      });

      it('si la próxima cita choca, no queda ninguna consulta a medias', async () => {
        const { citaId, atencionId, hijo, hija } = await visitaProgramada();
        const ocupado = await inicioCitaMedicaLibre(prisma);
        const { expediente: otro } = await crearExpediente(prisma, medica.id, [
          'MEDICA',
        ]);
        await programar(
          {
            referidoId: otro.referidos[0].id,
            personas: [null],
            duracionMin: 30,
            inicio: ocupado,
          },
          201,
        );
        await registrar({
          citaId,
          atencionId,
          registros: [registro(null), registro(hijo.id), registro(hija.id)],
          proxima: { inicio: ocupado, duracionMin: 30, personas: [null] },
        }).expect(409);
        expect(await prisma.consultaMedica.count({ where: { citaId } })).toBe(
          0,
        );
        const cita = await prisma.citaMedica.findUniqueOrThrow({
          where: { id: citaId },
          select: { estado: true },
        });
        expect(cita.estado).toBe('PROGRAMADA');
      });

      it('la historia agrupa la visita y, filtrada por un hijo/a, solo trae su consulta', async () => {
        const { citaId, atencionId, hijo, hija, expediente } =
          await visitaProgramada();
        await registrar({
          citaId,
          atencionId,
          registros: [registro(null), registro(hijo.id), registro(hija.id)],
        }).expect(201);
        const ruta = `/api/medica/pacientes/${expediente.usuariaId}/consultas`;

        const todas = await pedir('get', ruta, sesionMedica).expect(200);
        const items = (todas.body as ConsultasMedicasPaginaDto).items;
        expect(items).toHaveLength(3);
        expect(new Set(items.map((c) => c.visita.clave))).toEqual(
          new Set([citaId]),
        );
        expect(items.every((c) => c.visita.primera)).toBe(true);

        const deHijo = await pedir('get', ruta, sesionMedica)
          .query({ persona: hijo.id })
          .expect(200);
        const [unica, ...resto] = (deHijo.body as ConsultasMedicasPaginaDto)
          .items;
        expect(resto).toHaveLength(0);
        expect(unica.persona.ninoId).toBe(hijo.id);
        // Solo dice con quién vino (ids), nunca trae las consultas de las demás personas.
        expect(unica.visita.personas.sort()).toEqual(
          [null, hijo.id, hija.id].sort(),
        );
        expect(unica.visita.horaFin).not.toBeNull();

        const ficha = await pedir(
          'get',
          `/api/medica/pacientes/${expediente.usuariaId}`,
          sesionMedica,
        ).expect(200);
        const porPersona = (ficha.body as FichaPacienteMedicaDto)
          .consultasPorPersona;
        expect(porPersona.map((p) => p.ninoId).sort()).toEqual(
          [null, hijo.id, hija.id].sort(),
        );
        expect(porPersona.every((p) => p.total === 1)).toBe(true);
      });

      it('una persona repetida responde 400', async () => {
        const { citaId, atencionId, hijo, hija } = await visitaProgramada();
        await registrar({
          citaId,
          atencionId,
          registros: [
            registro(null),
            registro(hijo.id),
            registro(hija.id),
            registro(hija.id),
          ],
        }).expect(400);
      });
    });

    it('una duración fuera del catálogo responde 400', async () => {
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      await programar(
        {
          referidoId: expediente.referidos[0].id,
          personas: [null],
          duracionMin: 45,
        },
        400,
      );
    });
  });

  describe('documento de otro expediente', () => {
    it('Medicina no firma un documento de un expediente que no le refirieron', async () => {
      // Quedó de una referencia anterior que Trabajo Social ya retiró.
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      await pedir(
        'get',
        `/api/medica/documentos/${documento.id}/url`,
        sesionMedica,
      ).expect(403);
    });

    it('Jurídico no firma el documento de otra usuaria pidiéndolo por la suya', async () => {
      const ajena = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        ajena.expediente.id,
        medica.id,
        { visibleJuridico: true },
      );
      const propia = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      await pedir(
        'get',
        `/api/juridico/usuarias/${propia.usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(403);
    });

    it('Jurídico no firma un documento de una atención que Medicina no compartió', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
        { visibleJuridico: false },
      );
      await pedir(
        'get',
        `/api/juridico/usuarias/${usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(403);
    });
  });

  describe('Consultas: historial y detalle', () => {
    // El día de las consultas de `crearAtencionConConsulta`.
    const RANGO = { desde: '2026-01-02', hasta: '2026-01-02' };

    /** DPI único: deja buscar exactamente a una usuaria entre las de todas las pruebas. */
    async function conDpi(usuariaId: string): Promise<string> {
      const dpi = `9${randomInt(10 ** 11, 10 ** 12)}`;
      await prisma.usuaria.update({ where: { id: usuariaId }, data: { dpi } });
      return dpi;
    }

    function buscar(datos: object, sesion: Sesion = sesionMedica) {
      return pedir(
        'post',
        '/api/medica/consultas/historial/busqueda',
        sesion,
      ).send(datos);
    }

    it('la lista solo trae metadatos; el contenido clínico sale al abrir la consulta', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      const { consulta } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      const dpi = await conDpi(usuaria.id);

      const lista = await buscar({ ...RANGO, q: dpi }).expect(200);
      const pagina = lista.body as HistorialConsultasMedicaPaginaDto;
      expect(lista.headers['cache-control']).toBe('no-store');
      expect(pagina.items).toHaveLength(1);
      expect(pagina.items[0]).toMatchObject({
        id: consulta.id,
        usuariaId: usuaria.id,
        totalDocumentos: 1,
      });
      for (const clave of [...DATOS_CLINICOS, 'signos']) {
        expect(JSON.stringify(lista.body)).not.toContain(clave);
      }

      const detalle = await pedir(
        'get',
        `/api/medica/consultas/${consulta.id}`,
        sesionMedica,
      ).expect(200);
      expect(detalle.headers['cache-control']).toBe('no-store');
      expect((detalle.body as ConsultaMedicaDto).diagnostico).toBe(
        `${MARCA} diagnóstico clínico`,
      );
      expect(
        await prisma.auditLog.count({
          where: {
            usuarioId: medica.id,
            accion: 'CONSULTA_MEDICA_VISTA',
            entidadId: consulta.id,
          },
        }),
      ).toBe(1);
    });

    it('una consulta de un expediente no referido no aparece y abrirla da el mismo 403 que un id inexistente', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      const { consulta } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      const dpi = await conDpi(usuaria.id);

      const lista = await buscar({ ...RANGO, q: dpi }).expect(200);
      expect((lista.body as HistorialConsultasMedicaPaginaDto).items).toEqual(
        [],
      );

      const ajena = await pedir(
        'get',
        `/api/medica/consultas/${consulta.id}`,
        sesionMedica,
      ).expect(403);
      const inexistente = await pedir(
        'get',
        `/api/medica/consultas/${randomUUID()}`,
        sesionMedica,
      ).expect(403);
      // Mismo mensaje y código: la respuesta no revela si la consulta existe.
      const sinHora = ({ statusCode, message }: Record<string, unknown>) => ({
        statusCode,
        message,
      });
      expect(sinHora(ajena.body as Record<string, unknown>)).toEqual(
        sinHora(inexistente.body as Record<string, unknown>),
      );
      expect(
        await prisma.auditLog.count({
          where: { accion: 'CONSULTA_MEDICA_VISTA', entidadId: consulta.id },
        }),
      ).toBe(0);
    });

    it('el texto buscado nunca queda en la auditoría', async () => {
      const buscadora = await crearUsuario(prisma, 'MEDICA');
      const termino = `${MARCA} Nombre Buscado`;
      await buscar({ ...RANGO, q: termino }, sesionDe(app, buscadora)).expect(
        200,
      );
      const filas = await prisma.auditLog.findMany({
        where: { usuarioId: buscadora.id },
      });
      expect(filas.map((f) => f.accion)).toEqual([
        'HISTORIAL_CONSULTAS_MEDICAS_CONSULTADO',
      ]);
      expect(filas[0].detalles).toMatchObject({ conBusqueda: true });
      expect(JSON.stringify(filas)).not.toContain('Buscado');
    });

    it('el día de la Agenda ya no trae lo que pasó a Consultas', async () => {
      const respuesta = await pedir(
        'get',
        '/api/medica/agenda/dia?fecha=2026-01-02',
        sesionMedica,
      ).expect(200);
      expect(Object.keys(respuesta.body as object).sort()).toEqual([
        'citas',
        'fecha',
        'sinProxima',
      ]);
    });

    it('la búsqueda no existe por GET con el texto en la URL', async () => {
      await pedir(
        'get',
        '/api/medica/consultas/historial/busqueda?q=Maria',
        sesionMedica,
      ).expect(404);
    });

    it('rechaza un rango de más de un año', async () => {
      await buscar({ desde: '2025-01-01', hasta: '2026-01-02' }).expect(400);
    });

    it('limita las búsquedas por usuario a 60 por minuto', async () => {
      const sesion = sesionDe(app, await crearUsuario(prisma, 'MEDICA'));
      for (let i = 0; i < 60; i++) {
        await buscar(RANGO, sesion).expect(200);
      }
      await buscar(RANGO, sesion).expect(429);
    });

    it('la historia clínica de la ficha deja constancia de cada página leída', async () => {
      const lectora = await crearUsuario(prisma, 'MEDICA');
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      await crearAtencionConConsulta(prisma, expediente.id, medica.id);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}/consultas`,
        sesionDe(app, lectora),
      ).expect(200);
      const filas = await prisma.auditLog.findMany({
        where: {
          usuarioId: lectora.id,
          accion: 'HISTORIA_CLINICA_MEDICA_CONSULTADA',
        },
      });
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        entidad: 'Usuaria',
        entidadId: usuaria.id,
        detalles: { persona: 'todas', pagina: 'primera', resultados: 1 },
      });
      for (const dato of DATOS_CLINICOS) {
        expect(JSON.stringify(filas)).not.toContain(dato);
      }
    });
  });

  describe('Agenda: buscador de pacientes', () => {
    async function conDpi(usuariaId: string): Promise<string> {
      const dpi = `8${randomInt(10 ** 11, 10 ** 12)}`;
      await prisma.usuaria.update({ where: { id: usuariaId }, data: { dpi } });
      return dpi;
    }

    function buscar(datos: object, sesion: Sesion = sesionMedica) {
      return pedir(
        'post',
        '/api/medica/agenda/programables/busqueda',
        sesion,
      ).send(datos);
    }

    it('encuentra por DPI y solo devuelve datos ligeros, sin motivo ni hijos por nombre', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      const dpi = await conDpi(usuaria.id);

      const respuesta = await buscar({ q: dpi }).expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      const items = respuesta.body as PacienteBuscadaMedicaDto[];
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        usuariaId: usuaria.id,
        nombreCompleto: `${usuaria.nombres} ${usuaria.apellidos}`,
        expedienteNumero: expediente.numero,
        situacion: 'POR_AGENDAR',
        hijos: 0,
        proximaCita: null,
        referidaEl: expect.any(String) as unknown,
      });
    });

    it('nunca devuelve a una usuaria no referida a Medicina ni a una dada de alta', async () => {
      const ajena = await crearExpediente(prisma, medica.id, ['JURIDICO']);
      const deAlta = await crearExpediente(prisma, medica.id, ['MEDICA']);
      const { atencion } = await crearAtencionConConsulta(
        prisma,
        deAlta.expediente.id,
        medica.id,
      );
      await prisma.atencionMedica.update({
        where: { id: atencion.id },
        data: {
          estado: 'ALTA',
          fechaAlta: new Date('2026-01-03'),
          motivoAlta: 'ALTA_MEDICA',
        },
      });
      for (const { usuaria } of [ajena, deAlta]) {
        const dpi = await conDpi(usuaria.id);
        const respuesta = await buscar({ q: dpi }).expect(200);
        expect(respuesta.body).toEqual([]);
      }
    });

    it('filtra por situación: la consulta sin cita solo ve las en atención', async () => {
      const enAtencion = await crearExpediente(prisma, medica.id, ['MEDICA']);
      await crearAtencionConConsulta(
        prisma,
        enAtencion.expediente.id,
        medica.id,
      );
      const porAgendar = await crearExpediente(prisma, medica.id, ['MEDICA']);
      const dpiEnAtencion = await conDpi(enAtencion.usuaria.id);
      const dpiPorAgendar = await conDpi(porAgendar.usuaria.id);

      const encontrada = await buscar({
        q: dpiEnAtencion,
        situacion: 'EN_ATENCION',
      }).expect(200);
      expect(
        (encontrada.body as PacienteBuscadaMedicaDto[]).map((p) => p.situacion),
      ).toEqual(['EN_ATENCION']);
      const excluida = await buscar({
        q: dpiPorAgendar,
        situacion: 'EN_ATENCION',
      }).expect(200);
      expect(excluida.body).toEqual([]);
    });

    it('sin texto sugiere hasta 5 por agendar, y ninguna si se piden solo las en atención', async () => {
      await crearExpediente(prisma, medica.id, ['MEDICA']);
      const sugerencias = (await buscar({}).expect(200))
        .body as PacienteBuscadaMedicaDto[];
      expect(sugerencias.length).toBeGreaterThan(0);
      expect(sugerencias.length).toBeLessThanOrEqual(5);
      expect(new Set(sugerencias.map((p) => p.situacion))).toEqual(
        new Set(['POR_AGENDAR']),
      );
      const enAtencion = await buscar({ situacion: 'EN_ATENCION' }).expect(200);
      expect(enAtencion.body).toEqual([]);
    });

    it('rechaza un nombre de menos de 3 letras', async () => {
      await buscar({ q: 'ma' }).expect(400);
    });

    it('la búsqueda no existe por GET con el texto en la URL', async () => {
      await pedir(
        'get',
        '/api/medica/agenda/programables/busqueda?q=Maria',
        sesionMedica,
      ).expect(404);
    });

    it('sin token CSRF responde 403', async () => {
      await request(app.getHttpServer())
        .post('/api/medica/agenda/programables/busqueda')
        .set('Cookie', sesionMedica.cookie)
        .send({ q: 'Maria' })
        .expect(403);
    });

    it('limita las búsquedas por usuario a 120 por minuto', async () => {
      const sesion = sesionDe(app, await crearUsuario(prisma, 'MEDICA'));
      for (let i = 0; i < 120; i++) {
        await buscar({ situacion: 'EN_ATENCION' }, sesion).expect(200);
      }
      await buscar({ situacion: 'EN_ATENCION' }, sesion).expect(429);
    });
  });

  describe('CSRF', () => {
    it.each([
      ['ausente', undefined],
      ['distinto al de la cookie', 'otro-token'],
    ])('con token %s una escritura responde 403', async (_caso, header) => {
      const peticion = request(app.getHttpServer())
        .post('/api/medica/citas')
        .set('Cookie', sesionMedica.cookie);
      if (header) {
        peticion.set('X-CSRF-Token', header);
      }
      const respuesta = await peticion
        .send({
          expedienteId: ID,
          personas: [null],
          duracionMin: 30,
          inicio: '2099-01-05T09:00',
        })
        .expect(403);
      expect(JSON.stringify(respuesta.body)).toContain('CSRF');
    });
  });

  describe('otras áreas no reciben datos clínicos', () => {
    let expedienteId: string;
    let usuariaId: string;

    beforeAll(async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      expedienteId = expediente.id;
      usuariaId = usuaria.id;
      await crearAtencionConConsulta(prisma, expediente.id, medica.id, {
        visibleJuridico: true,
      });
    });

    function sinDatosClinicos(cuerpo: unknown) {
      const texto = JSON.stringify(cuerpo);
      for (const dato of DATOS_CLINICOS) {
        expect(texto).not.toContain(dato);
      }
    }

    it('Trabajo Social ve el estado y las fechas, nunca diagnóstico, plan ni receta', async () => {
      const respuesta = await pedir(
        'get',
        `/api/trabajo-social/expedientes/${expedienteId}/compartido`,
        sesiones.get('TRABAJO_SOCIAL')!,
      ).expect(200);
      expect(JSON.stringify(respuesta.body)).toContain('En atención');
      sinDatosClinicos(respuesta.body);
    });

    it('Jurídico ve fechas y documentos, nunca datos clínicos', async () => {
      const respuesta = await pedir(
        'get',
        `/api/juridico/usuarias/${usuariaId}/medicina`,
        sesiones.get('JURIDICO')!,
      ).expect(200);
      expect(respuesta.body).toHaveLength(1);
      expect(
        (respuesta.body as VistaMedicaParaJuridico[])[0].documentos,
      ).toHaveLength(1);
      sinDatosClinicos(respuesta.body);
    });
  });
});
