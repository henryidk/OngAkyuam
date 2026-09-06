import { useMemo, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import PanelLayout from '../../components/PanelLayout';
import { api } from '../../lib/api';

export default function Reportes() {
  const [expedientes, setExpedientes] = useState<any[]>([]);
  
  useEffect(() => {
    api.get('/expedientes').then(res => setExpedientes(res.data));
  }, []);
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 15;

  const getRangoEdad = (edad: number | undefined) => {
    if (edad === undefined) return 'N/A';
    if (edad <= 13) return '0-13';
    if (edad <= 30) return '14-30';
    if (edad <= 60) return '31-60';
    return 'Mayores de 60';
  };

  const reportData = useMemo(() => {
    return expedientes.map((exp, index) => {
      // The API returns the raw Expediente model fields.
      const fechaIngreso = exp.fechaIngreso ? new Date(exp.fechaIngreso).toISOString().split('T')[0] : '';
      const fechaNacimiento = exp.fechaNacimiento ? new Date(exp.fechaNacimiento).toISOString().split('T')[0] : 'N/A';
      const nombreApellido = `${exp.nombresUsuaria || ''} ${exp.apellidosUsuaria || ''}`.trim();
      
      return {
        no: index + 1,
        fechaIngreso,
        departamento: exp.departamento || 'Alta Verapaz',
        municipio: exp.municipio || 'N/A',
        numeroCaso: exp.codigoCaso || 'N/A',
        fechaNacimiento: fechaNacimiento,
        edad: exp.edad || 'N/A',
        nombreApellido: nombreApellido || 'N/A',
        dpi: exp.dpi || 'N/A',
        genero: exp.genero || 'N/A',
        rangoEdad: getRangoEdad(exp.edad),
        tipoRegistro: exp.condicionRegistro || 'N/A',
        estadoGeneral: 'EN PROCESO', // Or exp.estado if added to schema
        grupoEtnico: exp.etnia || 'N/A',
        ubicacionGeografica: 'Urbana', // Update if mapped in schema
        tipologia: exp.tipologiasViolencia?.join(', ') || 'N/A',
      };
    });
  }, [expedientes]);

  const totalPaginas = Math.ceil(reportData.length / itemsPorPagina);
  const paginatedData = useMemo(() => {
    const start = (paginaActual - 1) * itemsPorPagina;
    return reportData.slice(start, start + itemsPorPagina);
  }, [reportData, paginaActual]);
  const exportPDF = async () => {
    // Tamaño legal en horizontal
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'legal'
    });
    
    // Pre-cargar logo
    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new window.Image();
      logoImg.src = '/logo.png';
      await new Promise((resolve) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = resolve;
      });
    } catch(e) {}

    const tableColumn = [
      "No.", "Fecha", "Depto.", "Municipio", "No. Caso", "F. Nac", "Edad", 
      "Género", "Rango Edad", "Usuaria", "Proceso", "Etnia", "Ubicación", "Tipología"
    ];
    
    const tableRows = reportData.map(row => [
      row.no,
      row.fechaIngreso,
      row.departamento,
      row.municipio,
      row.numeroCaso,
      row.fechaNacimiento,
      row.edad,
      row.genero,
      row.rangoEdad,
      row.tipoRegistro,
      row.estadoGeneral,
      row.grupoEtnico,
      row.ubicacionGeografica,
      row.tipologia
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      margin: { top: 30, right: 10, bottom: 15, left: 10 },
      theme: 'grid',
      headStyles: { fillColor: [40, 31, 101], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        const pageWidth = doc.internal.pageSize.width;
        
        // Encabezado
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("CENTRO DE APOYO INTEGRAL PARA MUJERES SOBREVIVIENTES DE VIOLENCIA DE ALTA VERAPAZ", pageWidth / 2, 12, { align: 'center' });
        doc.text("\"AK' YU'AM\"", pageWidth / 2, 17, { align: 'center' });
        doc.text("DEL COMITÉ EJECUTIVO DE JUSTICIA DE ALTA VERAPAZ", pageWidth / 2, 22, { align: 'center' });
        
        if (logoImg && logoImg.width > 0) {
           doc.addImage(logoImg, 'PNG', pageWidth - 45, 6, 32, 20); 
        }

        // Pie de página
        const footerText = `Generado el: ${new Date().toLocaleDateString('es-GT')} a las ${new Date().toLocaleTimeString('es-GT')}`;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(footerText, 10, doc.internal.pageSize.height - 8);
        doc.text(`Página ${data.pageNumber}`, pageWidth - 10, doc.internal.pageSize.height - 8, { align: 'right' });
      }
    });

    const defaultName = `reporte_trabajo_social_${new Date().toISOString().split('T')[0]}.pdf`;

    try {
      if ('showSaveFilePicker' in window) {
        const pdfBlob = doc.output('blob');
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Documento PDF',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
      } else {
        doc.save(defaultName);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error guardando el PDF:', err);
      }
    }
  };

  return (
    <PanelLayout>
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1F2937' }}>Base de Datos Interna</h1>
          </div>
        </div>

        <button 
          onClick={exportPDF} 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
        >
          <Download size={18} />
          <span>Exportar a PDF</span>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-container" style={{ margin: '16px', overflowX: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '0.85rem', minWidth: '2200px' }}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Fecha</th>
                <th>Departamento</th>
                <th>Municipio</th>
                <th>No. Caso</th>
                <th>F. Nacimiento</th>
                <th>Edad</th>
                <th style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>Nombre y apellido</th>
                <th style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>DPI</th>
                <th>Género</th>
                <th>Rango Edad</th>
                <th>Usuaria</th>
                <th>Proceso</th>
                <th>Grupo Étnico</th>
                <th>Ubicación</th>
                <th>Tipología 22-2008</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => (
                <tr key={row.numeroCaso}>
                  <td>{row.no}</td>
                  <td>{row.fechaIngreso}</td>
                  <td>{row.departamento}</td>
                  <td>{row.municipio}</td>
                  <td><strong>{row.numeroCaso}</strong></td>
                  <td>{row.fechaNacimiento}</td>
                  <td>{row.edad}</td>
                  <td style={{ backgroundColor: '#FEF2F2', fontWeight: 600 }}>{row.nombreApellido}</td>
                  <td style={{ backgroundColor: '#FEF2F2' }}>{row.dpi}</td>
                  <td>{row.genero}</td>
                  <td>{row.rangoEdad}</td>
                  <td><span className="badge" style={{ backgroundColor: row.tipoRegistro === 'INTERNA' ? '#DBEAFE' : '#D1FAE5', color: row.tipoRegistro === 'INTERNA' ? '#1E40AF' : '#065F46' }}>{row.tipoRegistro}</span></td>
                  <td><span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>{row.estadoGeneral}</span></td>
                  <td>{row.grupoEtnico}</td>
                  <td>{row.ubicacionGeografica}</td>
                  <td>{row.tipologia}</td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>
                    No hay expedientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {reportData.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderTop: '1px solid #E5E7EB', fontSize: '0.82rem', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ color: '#4B5563', fontWeight: 700 }}>
              Mostrando <strong style={{ color: '#281F65' }}>{(paginaActual - 1) * itemsPorPagina + 1}</strong> a <strong style={{ color: '#281F65' }}>{Math.min(paginaActual * itemsPorPagina, reportData.length)}</strong> de <strong style={{ color: '#281F65' }}>{reportData.length}</strong> expedientes
            </div>
            
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                  disabled={paginaActual === 1}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    background: paginaActual === 1 ? '#F3F4F6' : '#FFFFFF',
                    color: paginaActual === 1 ? '#9CA3AF' : '#374151',
                    fontWeight: 800,
                    cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Anterior</span>
                </button>

                {(() => {
                  const paginas: (number | string)[] = [];
                  if (totalPaginas <= 7) {
                    for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
                  } else {
                    paginas.push(1);
                    if (paginaActual > 3) paginas.push('...');
                    
                    const inicio = Math.max(2, paginaActual - 1);
                    const fin = Math.min(totalPaginas - 1, paginaActual + 1);
                    for (let i = inicio; i <= fin; i++) paginas.push(i);

                    if (paginaActual < totalPaginas - 2) paginas.push('...');
                    paginas.push(totalPaginas);
                  }

                  return paginas.map((p, idx) => typeof p === 'string' ? (
                    <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#9CA3AF', fontWeight: 800 }}>...</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPaginaActual(p)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: paginaActual === p ? '2px solid #613E9D' : '1px solid #E5E7EB',
                        background: paginaActual === p ? '#613E9D' : '#FFFFFF',
                        color: paginaActual === p ? '#FFFFFF' : '#374151',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ));
                })()}

                <button
                  type="button"
                  onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaActual === totalPaginas}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    background: paginaActual === totalPaginas ? '#F3F4F6' : '#FFFFFF',
                    color: paginaActual === totalPaginas ? '#9CA3AF' : '#374151',
                    fontWeight: 800,
                    cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Siguiente</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </PanelLayout>
  );
}
