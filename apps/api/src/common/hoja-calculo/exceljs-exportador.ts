import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type {
  HojaCalculo,
  IExportadorHojaCalculo,
  ValorCeldaHoja,
} from './exportador-hoja-calculo.interface';

const MS_POR_DIA = 86_400_000;
/** Día 0 del sistema de fechas de Excel (1900, con el desfase histórico del 29/02/1900). */
const EPOCA_EXCEL_UTC = Date.UTC(1899, 11, 30);

/**
 * "YYYY-MM-DD" → número de serie de Excel. `Date.UTC` se usa solo para contar días entre dos
 * fechas de calendario (sin zona horaria de por medio); el valor nunca se guarda como `Date`.
 */
export function serialExcelDeFecha(fechaIso: string): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return (Date.UTC(anio, mes - 1, dia) - EPOCA_EXCEL_UTC) / MS_POR_DIA;
}

/**
 * Implementación con `exceljs`. Los textos se escriben como valores, no como fórmulas: un
 * nombre que empiece con "=" no se ejecuta al abrir el archivo.
 */
@Injectable()
export class ExcelJsExportador implements IExportadorHojaCalculo {
  readonly tipoContenido =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly extension = 'xlsx';

  async generar(hoja: HojaCalculo): Promise<Buffer> {
    const libro = new Workbook();
    // Sin nombre de la persona que exporta en los metadatos del archivo.
    libro.creator = 'AKyuam';

    const hojaExcel = libro.addWorksheet(hoja.nombreHoja, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    hojaExcel.columns = hoja.columnas.map((columna) => ({
      header: columna.titulo,
      width: columna.ancho,
      style: columna.tipo === 'fecha' ? { numFmt: 'dd/mm/yyyy' } : {},
    }));
    hojaExcel.getRow(1).font = { bold: true };

    for (const fila of hoja.filas) {
      hojaExcel.addRow(
        fila.map((valor, indice) =>
          this.valorCelda(valor, hoja.columnas[indice]?.tipo),
        ),
      );
    }

    if (hoja.filas.length > 0) {
      hojaExcel.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columnas.length },
      };
    }

    const contenido = await libro.xlsx.writeBuffer();
    return Buffer.from(contenido);
  }

  private valorCelda(
    valor: ValorCeldaHoja,
    tipo: string | undefined,
  ): string | number | null {
    if (valor === null) {
      return null;
    }
    if (tipo === 'fecha' && typeof valor === 'string') {
      return serialExcelDeFecha(valor);
    }
    return valor;
  }
}
