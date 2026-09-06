import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, PenTool, Save, Plus, FileText, Activity, 
  CloudUpload, FolderPlus, Eye, Upload
} from 'lucide-react';
import PanelLayout from '../../components/PanelLayout';
import { api } from '../../lib/api';

export default function Gestion() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'caratula' | 'entrevista' | 'bitacora' | 'archivos'>('caratula');
  const [expediente, setExpediente] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States for Caratula editing
  const [isEditingCaratula, setIsEditingCaratula] = useState(false);
  const [caratulaForm, setCaratulaForm] = useState<any>({});

  // States for Entrevista
  const [entrevistaForm, setEntrevistaForm] = useState({
    descripcionHecho: '',
    observacionesEntrevista: ''
  });

  // States for Bitacora
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [nuevaBitacora, setNuevaBitacora] = useState({
    descripcion: ''
  });

  // States for Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categoriaArchivo, setCategoriaArchivo] = useState('DPI');

  useEffect(() => {
    if (id) fetchExpediente();
  }, [id]);

  const fetchExpediente = async () => {
    try {
      const res = await api.get(`/expedientes/${id}`);
      setExpediente(res.data);
      setCaratulaForm({
        nombresUsuaria: res.data.nombresUsuaria || '',
        apellidosUsuaria: res.data.apellidosUsuaria || '',
        dpi: res.data.dpi || '',
        fechaNacimiento: res.data.fechaNacimiento ? res.data.fechaNacimiento.split('T')[0] : '',
        edad: res.data.edad || '',
        genero: res.data.genero || 'Femenino',
        telefono: res.data.telefono || '',
        direccion: res.data.direccion || '',
        departamento: res.data.departamento || '',
        municipio: res.data.municipio || '',
        grupoEtnico: res.data.grupoEtnico || '',
        ubicacionGeografica: res.data.ubicacionGeo || '',
        nombresAgresor: res.data.nombresAgresor || '',
        apellidosAgresor: res.data.apellidosAgresor || '',
        telefonoAgresor: res.data.telefonoAgresor || '',
        direccionAgresor: res.data.direccionAgresor || '',
        condicionRegistro: res.data.condicionRegistro || 'INTERNA',
      });
      if (res.data.trabajoSocial) {
        setEntrevistaForm({
          descripcionHecho: res.data.trabajoSocial.descripcionHecho || '',
          observacionesEntrevista: res.data.trabajoSocial.observacionesEntrevista || ''
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCaratula = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.put(`/expedientes/${id}/caratula`, caratulaForm);
    setIsEditingCaratula(false);
    fetchExpediente();
  };

  const handleSaveEntrevista = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/expedientes/${id}/entrevista`, entrevistaForm);
    alert('Entrevista guardada');
    fetchExpediente();
  };

  const handleSaveBitacora = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/expedientes/${id}/bitacora`, nuevaBitacora);
    setShowBitacoraModal(false);
    setNuevaBitacora({ descripcion: '' });
    fetchExpediente();
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoria', categoriaArchivo);
    await api.post(`/expedientes/${id}/archivos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setShowUploadModal(false);
    setFile(null);
    fetchExpediente();
  };

  if (loading) return <PanelLayout><div>Cargando...</div></PanelLayout>;
  if (!expediente) return <PanelLayout><div>No encontrado</div></PanelLayout>;

  return (
    <PanelLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(40, 31, 101, 0.12)' }}>
          <div>
            <span style={{ background: '#281F65', color: '#FFFFFF', padding: '4px 12px', borderRadius: '8px', fontWeight: 900, fontSize: '0.85rem' }}>
              GESTIÓN DE EXPEDIENTE N° {expediente.codigoCaso}
            </span>
            <h3 style={{ margin: '6px 0 0 0', color: '#281F65', fontSize: '1.2rem', fontWeight: 800 }}>
              {expediente.nombresUsuaria} {expediente.apellidosUsuaria}
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/trabajo-social/registros')}
            style={{ fontWeight: 800, fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '2px solid #E5E7EB', display: 'flex', gap: '4px', background: '#FFFFFF', padding: '8px 16px 0 16px', borderRadius: '14px 14px 0 0' }}>
          {[
            { id: 'caratula', label: 'Datos del Expediente', icon: FolderPlus },
            { id: 'entrevista', label: 'Entrevista Inicial', icon: FileText },
            { id: 'bitacora', label: `Actividades (${expediente.bitacora?.length || 0})`, icon: Activity },
            { id: 'archivos', label: `Archivo Digital (${expediente.archivos?.length || 0})`, icon: CloudUpload },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #613E9D' : '3px solid transparent',
                background: 'transparent',
                color: activeTab === tab.id ? '#613E9D' : '#6B7280',
                fontWeight: activeTab === tab.id ? 900 : 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Carátula */}
        {activeTab === 'caratula' && (
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#281F65', fontWeight: 900 }}>Datos de la Usuaria</h4>
              {!isEditingCaratula ? (
                <button className="btn btn-outline" onClick={() => setIsEditingCaratula(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <PenTool size={14} /> Editar
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSaveCaratula} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Save size={14} /> Guardar
                </button>
              )}
            </div>

            {!isEditingCaratula ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '0.9rem' }}>
                <div><strong>Nombres:</strong> {caratulaForm.nombresUsuaria || '-'}</div>
                <div><strong>Apellidos:</strong> {caratulaForm.apellidosUsuaria || '-'}</div>
                <div><strong>DPI:</strong> {caratulaForm.dpi || '-'}</div>
                <div><strong>F. Nacimiento:</strong> {caratulaForm.fechaNacimiento || '-'}</div>
                <div><strong>Edad:</strong> {caratulaForm.edad || '-'}</div>
                <div><strong>Género:</strong> {caratulaForm.genero || '-'}</div>
                <div><strong>Teléfono:</strong> {caratulaForm.telefono || '-'}</div>
                <div><strong>Dirección:</strong> {caratulaForm.direccion || '-'}</div>
                <div><strong>Departamento:</strong> {caratulaForm.departamento || '-'}</div>
                <div><strong>Municipio:</strong> {caratulaForm.municipio || '-'}</div>
                <div><strong>Ubicación:</strong> {caratulaForm.ubicacionGeografica || '-'}</div>
                <div><strong>Grupo Étnico:</strong> {caratulaForm.grupoEtnico || '-'}</div>
              </div>
            ) : (
              <form style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}><h5 style={{ margin: '10px 0 0', color: '#281F65' }}>Datos de la Usuaria</h5></div>
                <div>
                  <label className="form-label">Nombres</label>
                  <input type="text" className="form-control" value={caratulaForm.nombresUsuaria} onChange={(e) => setCaratulaForm({...caratulaForm, nombresUsuaria: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Apellidos</label>
                  <input type="text" className="form-control" value={caratulaForm.apellidosUsuaria} onChange={(e) => setCaratulaForm({...caratulaForm, apellidosUsuaria: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">DPI</label>
                  <input type="text" className="form-control" value={caratulaForm.dpi} onChange={(e) => setCaratulaForm({...caratulaForm, dpi: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Teléfono</label>
                  <input type="text" className="form-control" value={caratulaForm.telefono} onChange={(e) => setCaratulaForm({...caratulaForm, telefono: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Dirección</label>
                  <input type="text" className="form-control" value={caratulaForm.direccion} onChange={(e) => setCaratulaForm({...caratulaForm, direccion: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Departamento</label>
                  <input type="text" className="form-control" value={caratulaForm.departamento} onChange={(e) => setCaratulaForm({...caratulaForm, departamento: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Municipio</label>
                  <input type="text" className="form-control" value={caratulaForm.municipio} onChange={(e) => setCaratulaForm({...caratulaForm, municipio: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Fecha Nacimiento</label>
                  <input type="date" className="form-control" value={caratulaForm.fechaNacimiento} onChange={(e) => setCaratulaForm({...caratulaForm, fechaNacimiento: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Edad</label>
                  <input type="number" className="form-control" value={caratulaForm.edad} onChange={(e) => setCaratulaForm({...caratulaForm, edad: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Género</label>
                  <input type="text" className="form-control" value={caratulaForm.genero} onChange={(e) => setCaratulaForm({...caratulaForm, genero: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Ubicación (Rural/Urbana)</label>
                  <input type="text" className="form-control" value={caratulaForm.ubicacionGeografica} onChange={(e) => setCaratulaForm({...caratulaForm, ubicacionGeografica: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Grupo Étnico</label>
                  <input type="text" className="form-control" value={caratulaForm.grupoEtnico} onChange={(e) => setCaratulaForm({...caratulaForm, grupoEtnico: e.target.value})} />
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Entrevista */}
        {activeTab === 'entrevista' && (
          <form onSubmit={handleSaveEntrevista} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#281F65', fontWeight: 900 }}>Descripción del Hecho de Violencia</h4>
              <textarea 
                className="form-control" 
                rows={4} 
                value={entrevistaForm.descripcionHecho} 
                onChange={(e) => setEntrevistaForm({...entrevistaForm, descripcionHecho: e.target.value})} 
                placeholder="Relate hechos de violencia..."
              />
            </div>

            <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#281F65', fontWeight: 900 }}>Observaciones</h4>
              <textarea 
                className="form-control" 
                rows={4} 
                value={entrevistaForm.observacionesEntrevista} 
                onChange={(e) => setEntrevistaForm({...entrevistaForm, observacionesEntrevista: e.target.value})} 
                placeholder="Observaciones adicionales..."
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Save size={16} /> Guardar Entrevista
            </button>
          </form>
        )}

        {/* Tab 3: Bitacora */}
        {activeTab === 'bitacora' && (
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#281F65', fontWeight: 900 }}>Bitácora de Actividades</h4>
              <button className="btn btn-primary" onClick={() => setShowBitacoraModal(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Plus size={14} /> Nuevo Registro
              </button>
            </div>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>FECHA Y HORA</th>
                    <th>ÁREA</th>
                    <th>ACTIVIDAD / REGISTRO</th>
                    <th>RESPONSABLE</th>
                  </tr>
                </thead>
                <tbody>
                  {(expediente.bitacora || []).map((b: any) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{new Date(b.createdAt).toLocaleString()}</td>
                      <td><span className="badge badge-purple">{b.area}</span></td>
                      <td style={{ maxWidth: '400px' }}>
                        <div style={{ fontWeight: 800 }}>{b.titulo}</div>
                        <div style={{ color: '#6B7280', marginTop: '4px' }}>{b.descripcion}</div>
                      </td>
                      <td>{b.usuarioNombre}</td>
                    </tr>
                  ))}
                  {expediente.bitacora?.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No hay registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Bitacora */}
            {showBitacoraModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <form onSubmit={handleSaveBitacora} className="card" style={{ width: '400px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0' }}>Agregar Registro</h3>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea 
                      className="form-control" 
                      rows={4} 
                      value={nuevaBitacora.descripcion} 
                      onChange={(e) => setNuevaBitacora({...nuevaBitacora, descripcion: e.target.value})} 
                      required 
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowBitacoraModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Guardar</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Archivos */}
        {activeTab === 'archivos' && (
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#281F65', fontWeight: 900 }}>Archivo Digital</h4>
              <button className="btn btn-primary" onClick={() => setShowUploadModal(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Upload size={14} /> Subir Documento
              </button>
            </div>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>DOCUMENTO</th>
                    <th>CATEGORÍA</th>
                    <th>TAMAÑO</th>
                    <th>FECHA</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {(expediente.archivos || []).map((doc: any) => (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 800 }}>{doc.nombre}</td>
                      <td><span className="badge badge-purple">{doc.categoria}</span></td>
                      <td>{doc.peso}</td>
                      <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                      <td>
                        <a href={`http://localhost:3000${doc.url}`} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '4px 8px' }}>
                          <Eye size={14} />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {expediente.archivos?.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No hay archivos</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Upload */}
            {showUploadModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <form onSubmit={handleUploadFile} className="card" style={{ width: '400px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0' }}>Subir Documento</h3>
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select className="form-select" value={categoriaArchivo} onChange={e => setCategoriaArchivo(e.target.value)}>
                      <option value="DPI">DPI</option>
                      <option value="Certificado Médico">Certificado Médico</option>
                      <option value="Denuncia">Denuncia</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Archivo PDF / Imagen</label>
                    <input type="file" className="form-control" onChange={(e: any) => setFile(e.target.files ? e.target.files[0] : null)} required />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={!file}>Subir</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>
    </PanelLayout>
  );
}
