import { Workbook } from 'exceljs';
import { ExcelJsExportador, serialExcelDeFecha } from './exceljs-exportador';

describe('serialExcelDeFecha', () => {
  it('convierte fechas de calendario al número de serie de Excel', () => {
    expect(serialExcelDeFecha('1900-03-01')).toBe(61);
    expect(serialExcelDeFecha('2026-09-28')).toBe(46293);
  });
});

describe('ExcelJsExportador', () => {
  it('escribe encabezados, fechas reales y textos que parecen fórmulas como texto', async () => {
    const exportador = new ExcelJsExportador();

    const contenido = await exportador.generar({
      nombreHoja: 'Prueba',
      columnas: [
        { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
        { titulo: 'Nombre', ancho: 20, tipo: 'texto' },
        { titulo: 'DPI', ancho: 16, tipo: 'texto' },
      ],
      filas: [['2026-09-28', '=HYPERLINK("x")', null]],
    });

    const libro = new Workbook();
    await libro.xlsx.load(contenido as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet('Prueba');
    expect(hoja?.getRow(1).values).toEqual([
      undefined,
      'Fecha',
      'Nombre',
      'DPI',
    ]);
    const celdaFecha = hoja?.getCell('A2');
    // exceljs devuelve la fecha como Date en UTC al leerla; el día debe ser exactamente el mismo.
    expect((celdaFecha?.value as Date).toISOString().slice(0, 10)).toBe(
      '2026-09-28',
    );
    expect(celdaFecha?.numFmt).toBe('dd/mm/yyyy');
    expect(hoja?.getCell('B2').value).toBe('=HYPERLINK("x")');
    expect(hoja?.getCell('B2').formula).toBeUndefined();
    expect(libro.creator).toBe('AKyuam');
  });
});
