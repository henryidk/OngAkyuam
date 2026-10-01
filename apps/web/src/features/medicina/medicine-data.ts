export const TODAY = "2026-08-18"
export const PROFESSIONAL = "Dra. Lucía Fernández"
export const CLINICS = ["Clínica médica 1", "Clínica médica 2"] as const
export const REFERRAL_TARGETS = [
  "No aplica",
  "Psicología",
  "Trabajo Social",
  "Fisioterapia",
  "Laboratorio clínico",
  "Hospital Regional de Cobán",
] as const

export type Diagnosis = { code: string; label: string }

export type VitalSigns = {
  systolic: number
  diastolic: number
  heartRate: number
  respiratoryRate: number
  temperature: number
  oxygenSaturation: number
  weight: number
  height: number
}

export type Prescription = { medication: string; dose: string; frequency: string; duration: string }

export type MedicalHistory = {
  personal: string
  surgical: string
  gyneco: string
  family: string
  medication: string
}

export type PatientStatus = "Nuevo ingreso" | "En tratamiento" | "Alta"

export type MedPatient = {
  id: string
  name: string
  age: number
  birthDate: string
  municipality: string
  phone: string
  bloodType: string
  status: PatientStatus
  allergies: string[]
  chronicConditions: string[]
  history: MedicalHistory
  referredBy: string
  referredOn: string
}

export type ConsultationStatus = "Programada" | "Atendida" | "Ausente"
export type ConsultationType = "Primera consulta" | "Reconsulta"

export type Consultation = {
  id: string
  isoDate: string
  dateLabel: string
  time: string
  patientId: string
  patientName: string
  reason: string
  type: ConsultationType
  place: string
  status: ConsultationStatus
  professional?: string
  vitals?: VitalSigns
  physicalExam?: string
  diagnoses?: Diagnosis[]
  plan?: string
  prescriptions?: Prescription[]
  evolution?: string
  referral?: string
}

export type ReferralPriority = "Alta" | "Media" | "Baja"

export type MedReferral = {
  id: string
  patientId: string
  patientName: string
  age: number
  municipality: string
  received: string
  reason: string
  priority: ReferralPriority
  socialWorker: string
  note: string
}

export const cie10Catalog: Diagnosis[] = [
  { code: "D50.9", label: "Anemia por deficiencia de hierro, sin otra especificación" },
  { code: "E03.9", label: "Hipotiroidismo, no especificado" },
  { code: "E11.9", label: "Diabetes mellitus tipo 2 sin complicaciones" },
  { code: "E66.9", label: "Obesidad, no especificada" },
  { code: "E78.5", label: "Hiperlipidemia, no especificada" },
  { code: "G43.9", label: "Migraña, no especificada" },
  { code: "G44.2", label: "Cefalea de tipo tensional" },
  { code: "G47.0", label: "Trastornos del inicio y del mantenimiento del sueño" },
  { code: "I10", label: "Hipertensión esencial (primaria)" },
  { code: "J00", label: "Rinofaringitis aguda (resfriado común)" },
  { code: "J02.9", label: "Faringitis aguda, no especificada" },
  { code: "K29.5", label: "Gastritis crónica, no especificada" },
  { code: "K30", label: "Dispepsia funcional" },
  { code: "L30.9", label: "Dermatitis, no especificada" },
  { code: "M17.9", label: "Gonartrosis, no especificada" },
  { code: "M54.5", label: "Lumbago no especificado" },
  { code: "N39.0", label: "Infección de vías urinarias, sitio no especificado" },
  { code: "N76.0", label: "Vaginitis aguda" },
  { code: "N94.6", label: "Dismenorrea, no especificada" },
  { code: "R10.4", label: "Otros dolores abdominales y los no especificados" },
  { code: "R51", label: "Cefalea" },
  { code: "T14.0", label: "Traumatismo superficial de región no especificada del cuerpo" },
  { code: "Z00.0", label: "Examen médico general" },
]

const dx = (code: string) => cie10Catalog.find((item) => item.code === code) as Diagnosis

const emptyHistory: MedicalHistory = { personal: "", surgical: "", gyneco: "", family: "", medication: "" }

type ClinicalProfile = {
  patient: Omit<MedPatient, "referredOn">
  lastVisit: string
  interval: number
  visits: number
  firstReason: string
  followReasons: string[]
  diagnoses: Diagnosis[]
  exam: string[]
  evolution: string[]
  plan: string[]
  prescriptions: Prescription[]
  vitals: { bp: [number, number, number, number]; weight: [number, number]; height: number; heartRate: number; temperature?: [number, number] }
  absentEvery?: number
  referTo?: Record<number, string>
}

const socialWorker = "Licda. Karla Rodas · Trabajo Social"

const profiles: ClinicalProfile[] = [
  {
    patient: { id: "CB-056-2026", name: "María Rosa Caal", age: 32, birthDate: "1994-03-11", municipality: "Cobán", phone: "5551 3081", bloodType: "O+", status: "En tratamiento", allergies: ["Penicilina"], chronicConditions: ["Gastritis crónica"], referredBy: socialWorker, history: { personal: "Gastritis diagnosticada en 2022, sin tratamiento continuo.", surgical: "Cesárea (2014).", gyneco: "G2 P1 C1 A0. Ciclos regulares. Sin método de planificación.", family: "Madre con diabetes mellitus tipo 2.", medication: "Ninguno al ingreso." } },
    lastVisit: "2026-07-30", interval: 21, visits: 8, absentEvery: 5,
    firstReason: "Dolor epigástrico urente de 3 meses de evolución, asociado a fatiga",
    followReasons: ["Control de gastritis y anemia", "Revisión de resultados de hemograma", "Control de tratamiento con hierro"],
    diagnoses: [dx("K29.5"), dx("D50.9")],
    exam: ["Palidez de piel y mucosas. Dolor a la palpación profunda en epigastrio, sin signos de irritación peritoneal.", "Palidez leve de mucosas. Epigastrio levemente doloroso a la palpación profunda.", "Mucosas rosadas. Sin dolor abdominal a la palpación."],
    evolution: ["Refiere disminución del dolor epigástrico con el uso de omeprazol. Persiste fatiga vespertina.", "Buena adherencia al tratamiento. Niega episodios de dolor en las últimas dos semanas.", "Hemoglobina de control en 11.2 g/dL (ingreso 9.4 g/dL). Mejoría de la fatiga.", "Asintomática. Tolera adecuadamente el sulfato ferroso."],
    plan: ["Omeprazol 20 mg en ayunas por 30 días. Sulfato ferroso 300 mg cada 24 horas. Dieta blanda fraccionada, evitar irritantes. Hemograma de control en 4 semanas.", "Continuar omeprazol y sulfato ferroso. Hemograma de control en próxima cita.", "Continuar sulfato ferroso hasta completar 3 meses. Omeprazol solo por razón necesaria."],
    prescriptions: [{ medication: "Omeprazol", dose: "20 mg", frequency: "1 cápsula en ayunas", duration: "30 días" }, { medication: "Sulfato ferroso", dose: "300 mg", frequency: "1 tableta cada 24 horas", duration: "90 días" }],
    vitals: { bp: [112, 72, 110, 70], weight: [58.4, 59.6], height: 1.52, heartRate: 86 },
  },
  {
    patient: { id: "SC-019-2026", name: "Elena Sofía Méndez", age: 41, birthDate: "1985-06-02", municipality: "San Cristóbal", phone: "5553 1105", bloodType: "A+", status: "En tratamiento", allergies: [], chronicConditions: ["Hipertensión arterial", "Obesidad"], referredBy: socialWorker, history: { personal: "Niega enfermedades crónicas previas al ingreso.", surgical: "Colecistectomía laparoscópica (2019).", gyneco: "G3 P3 C0 A0. Planificación: DIU.", family: "Padre con hipertensión arterial. Madre fallecida por evento cerebrovascular.", medication: "Ninguno al ingreso." } },
    lastVisit: "2026-07-19", interval: 30, visits: 7,
    firstReason: "Cefalea occipital y cifras elevadas de presión arterial detectadas en jornada de salud",
    followReasons: ["Control de presión arterial", "Control de hipertensión y peso", "Seguimiento de tratamiento antihipertensivo"],
    diagnoses: [dx("I10"), dx("E66.9")],
    exam: ["Obesidad central, perímetro abdominal 98 cm. Resto sin hallazgos positivos.", "Perímetro abdominal 96 cm. Sin edema en miembros inferiores.", "Perímetro abdominal 93 cm. Sin hallazgos positivos adicionales."],
    evolution: ["Refiere disminución de cefaleas desde el inicio de losartán. Inicia caminatas 3 veces por semana.", "Buena adherencia. Registro domiciliario de PA entre 130-140/85-90 mmHg.", "Pérdida de 3 kg desde el ingreso. Niega cefalea, mareos o visión borrosa.", "Cifras tensionales en metas. Mantiene plan de alimentación."],
    plan: ["Losartán 50 mg cada 24 horas. Dieta hiposódica (menos de 2 g de sodio al día). Actividad física 150 min/semana. Laboratorios: creatinina, perfil lipídico y glucosa en ayunas.", "Continuar losartán 50 mg. Reforzar dieta hiposódica. Revisión de laboratorios en próxima cita.", "Continuar tratamiento actual. Control de PA mensual. Mantener actividad física."],
    prescriptions: [{ medication: "Losartán", dose: "50 mg", frequency: "1 tableta cada 24 horas", duration: "30 días" }],
    vitals: { bp: [158, 98, 128, 82], weight: [78.5, 74.2], height: 1.56, heartRate: 82 },
  },
  {
    patient: { id: "TC-008-2026", name: "Rosa Teresa García", age: 29, birthDate: "1997-01-24", municipality: "Tactic", phone: "5552 7347", bloodType: "B+", status: "Alta", allergies: ["Sulfonamidas"], chronicConditions: [], referredBy: socialWorker, history: { personal: "Infecciones urinarias a repetición (3 episodios en 2025).", surgical: "Ninguno.", gyneco: "G1 P1 C0 A0. Planificación: implante subdérmico.", family: "Sin antecedentes relevantes.", medication: "Ninguno." } },
    lastVisit: "2026-06-19", interval: 14, visits: 4,
    firstReason: "Disuria, polaquiuria y fiebre de 2 días de evolución",
    followReasons: ["Control de infección urinaria", "Revisión de urocultivo", "Control postratamiento"],
    diagnoses: [dx("N39.0")],
    exam: ["Dolor a la palpación en región suprapúbica. Puño percusión negativa bilateral.", "Molestia leve suprapúbica a la palpación.", "Sin hallazgos positivos."],
    evolution: ["Remisión de fiebre a las 48 horas de iniciado el antibiótico. Persiste disuria leve.", "Urocultivo de control negativo. Asintomática.", "Asintomática. Se otorga alta médica con indicaciones preventivas."],
    plan: ["Nitrofurantoína 100 mg cada 12 horas por 7 días. Acetaminofén 500 mg cada 8 horas si presenta fiebre. Aumentar ingesta de líquidos. Urocultivo de control.", "Completar antibiótico. Urocultivo de control en 1 semana.", "Alta médica. Medidas higiénicas y de hidratación. Consultar si reaparecen síntomas."],
    prescriptions: [{ medication: "Nitrofurantoína", dose: "100 mg", frequency: "1 cápsula cada 12 horas", duration: "7 días" }, { medication: "Acetaminofén", dose: "500 mg", frequency: "1 tableta cada 8 horas si hay fiebre", duration: "3 días" }],
    vitals: { bp: [110, 70, 108, 68], weight: [61, 61.2], height: 1.58, heartRate: 90, temperature: [38.2, 36.5] },
    referTo: { 0: "Laboratorio clínico" },
  },
  {
    patient: { id: "CB-078-2026", name: "Marta Lidia Tzi", age: 54, birthDate: "1972-02-17", municipality: "Cobán", phone: "5550 4412", bloodType: "A+", status: "En tratamiento", allergies: [], chronicConditions: ["Diabetes mellitus tipo 2", "Hipertensión arterial"], referredBy: socialWorker, history: { personal: "Hipertensión arterial diagnosticada en 2021, tratamiento irregular.", surgical: "Histerectomía abdominal (2012).", gyneco: "G5 P5 C0 A0. Menopausia a los 48 años.", family: "Madre y dos hermanos con diabetes mellitus tipo 2.", medication: "Enalapril 10 mg (uso irregular)." } },
    lastVisit: "2026-07-21", interval: 28, visits: 8, absentEvery: 4,
    firstReason: "Poliuria, polidipsia y visión borrosa; glucosa capilar de 286 mg/dL",
    followReasons: ["Control de diabetes mellitus", "Control metabólico y de presión arterial", "Revisión de hemoglobina glicosilada"],
    diagnoses: [dx("E11.9"), dx("I10")],
    exam: ["Glucosa capilar 286 mg/dL. Acantosis nigricans en cuello. Sensibilidad disminuida con monofilamento en planta de pie derecho.", "Glucosa capilar 184 mg/dL. Sensibilidad disminuida en pie derecho, sin lesiones.", "Glucosa capilar 132 mg/dL. Pies sin lesiones ni úlceras."],
    evolution: ["Refiere disminución de poliuria y polidipsia. Adherencia parcial a la dieta.", "HbA1c de control 8.1 % (ingreso 10.4 %). Mejor adherencia a metformina.", "Glucosas capilares en ayunas entre 110-140 mg/dL según registro domiciliario.", "HbA1c 7.2 %. Sin episodios de hipoglucemia."],
    plan: ["Metformina 850 mg cada 12 horas con alimentos. Enalapril 10 mg cada 24 horas. Plan de alimentación para diabetes. HbA1c, perfil lipídico, creatinina y examen general de orina.", "Continuar metformina y enalapril. Cuidado diario de pies. Referencia a oftalmología para fondo de ojo.", "Continuar tratamiento. HbA1c de control en 3 meses."],
    prescriptions: [{ medication: "Metformina", dose: "850 mg", frequency: "1 tableta cada 12 horas con alimentos", duration: "30 días" }, { medication: "Enalapril", dose: "10 mg", frequency: "1 tableta cada 24 horas", duration: "30 días" }],
    vitals: { bp: [146, 92, 132, 84], weight: [72, 69.5], height: 1.5, heartRate: 80 },
    referTo: { 0: "Laboratorio clínico", 2: "Hospital Regional de Cobán" },
  },
  {
    patient: { id: "CB-066-2026", name: "Sandra Beatriz Coc", age: 23, birthDate: "2003-09-05", municipality: "Cobán", phone: "5557 9021", bloodType: "O+", status: "En tratamiento", allergies: [], chronicConditions: [], referredBy: socialWorker, history: { personal: "Niega enfermedades crónicas.", surgical: "Ninguno.", gyneco: "G0. Ciclos regulares. Sin método de planificación.", family: "Madre con migraña.", medication: "Ninguno." } },
    lastVisit: "2026-07-28", interval: 21, visits: 5,
    firstReason: "Cefalea frontal opresiva diaria de 1 mes de evolución y dificultad para dormir",
    followReasons: ["Control de cefalea tensional", "Seguimiento de patrón de sueño", "Control de cefalea e insomnio"],
    diagnoses: [dx("G44.2"), dx("G47.0")],
    exam: ["Contractura de trapecios y músculos cervicales posteriores, dolorosa a la palpación. Examen neurológico sin focalización.", "Contractura leve en trapecio derecho. Examen neurológico normal.", "Sin hallazgos positivos."],
    evolution: ["Disminución de la frecuencia de cefalea a 2-3 episodios por semana. Duerme 5 horas por noche.", "Cefalea ocasional de leve intensidad. Mejora con higiene del sueño. Continúa proceso en Psicología.", "Duerme 6-7 horas. Niega cefalea en las últimas 2 semanas."],
    plan: ["Ibuprofeno 400 mg cada 8 horas por 5 días, luego solo si hay dolor. Higiene del sueño. Ejercicios de estiramiento cervical. Interconsulta con Psicología.", "Analgesia solo por razón necesaria. Mantener higiene del sueño y seguimiento en Psicología.", "Continuar medidas no farmacológicas. Control en 1 mes."],
    prescriptions: [{ medication: "Ibuprofeno", dose: "400 mg", frequency: "1 tableta cada 8 horas con alimentos", duration: "5 días" }],
    vitals: { bp: [118, 76, 114, 72], weight: [54, 54.5], height: 1.55, heartRate: 84 },
    referTo: { 0: "Psicología" },
  },
  {
    patient: { id: "SP-011-2026", name: "Carmen Alicia Xol", age: 38, birthDate: "1988-04-30", municipality: "San Pedro Carchá", phone: "5554 6630", bloodType: "O-", status: "En tratamiento", allergies: [], chronicConditions: [], referredBy: "Lic. Mario Cú · Trabajo Social", history: { personal: "Niega enfermedades crónicas.", surgical: "Apendicectomía (2008).", gyneco: "G4 P3 C0 A1. Planificación: inyección trimestral.", family: "Sin antecedentes relevantes.", medication: "Ninguno." } },
    lastVisit: "2026-08-04", interval: 14, visits: 6, absentEvery: 3,
    firstReason: "Dolor lumbar de 2 semanas de evolución que aumenta al cargar peso",
    followReasons: ["Control de lumbalgia", "Seguimiento de dolor lumbar", "Revisión de evolución con fisioterapia"],
    diagnoses: [dx("M54.5")],
    exam: ["Contractura paravertebral lumbar bilateral. Lasègue negativo bilateral. Fuerza y reflejos conservados.", "Contractura paravertebral leve izquierda. Lasègue negativo.", "Movilidad lumbar completa, sin dolor a la palpación."],
    evolution: ["Disminución del dolor de 8/10 a 5/10 (escala EVA). Realiza ejercicios en casa de forma irregular.", "Dolor 3/10. Asiste a fisioterapia 2 veces por semana.", "Dolor 1/10. Retoma actividades cotidianas sin limitación."],
    plan: ["Diclofenaco 50 mg cada 12 horas por 7 días. Calor local 20 minutos cada 8 horas. Higiene postural. Referencia a fisioterapia.", "Suspender AINE. Continuar fisioterapia y ejercicios de fortalecimiento lumbar.", "Continuar ejercicios en casa. Control según necesidad."],
    prescriptions: [{ medication: "Diclofenaco", dose: "50 mg", frequency: "1 tableta cada 12 horas con alimentos", duration: "7 días" }],
    vitals: { bp: [124, 80, 120, 78], weight: [66, 65.2], height: 1.53, heartRate: 78 },
    referTo: { 0: "Fisioterapia" },
  },
  {
    patient: { id: "CB-044-2026", name: "Claudia Verónica Aj", age: 35, birthDate: "1991-11-12", municipality: "Cobán", phone: "5556 8063", bloodType: "B-", status: "Alta", allergies: ["Ácido acetilsalicílico"], chronicConditions: [], referredBy: socialWorker, history: { personal: "Asma en la infancia, sin crisis desde hace 10 años.", surgical: "Ninguno.", gyneco: "G2 P2 C0 A0. Sin método de planificación.", family: "Sin antecedentes relevantes.", medication: "Ninguno." } },
    lastVisit: "2026-05-22", interval: 7, visits: 2,
    firstReason: "Rinorrea, odinofagia y malestar general de 3 días",
    followReasons: ["Control de cuadro respiratorio"],
    diagnoses: [dx("J00")],
    exam: ["Faringe hiperémica sin exudado. Rinorrea hialina. Campos pulmonares limpios.", "Sin hallazgos positivos."],
    evolution: ["Resolución del cuadro. Asintomática. Se otorga alta médica."],
    plan: ["Acetaminofén 500 mg cada 8 horas por 3 días. Hidratación abundante y reposo relativo. Se explican signos de alarma.", "Alta médica."],
    prescriptions: [{ medication: "Acetaminofén", dose: "500 mg", frequency: "1 tableta cada 8 horas", duration: "3 días" }],
    vitals: { bp: [116, 74, 114, 72], weight: [63, 63], height: 1.6, heartRate: 90, temperature: [37.9, 36.6] },
  },
  {
    patient: { id: "SC-027-2026", name: "Gloria Esperanza Pop", age: 47, birthDate: "1979-07-08", municipality: "San Cristóbal", phone: "5559 1187", bloodType: "A-", status: "En tratamiento", allergies: [], chronicConditions: ["Hipotiroidismo"], referredBy: socialWorker, history: { personal: "Niega enfermedades crónicas previas al ingreso.", surgical: "Cesárea (2005 y 2009).", gyneco: "G2 P0 C2 A0. Ciclos irregulares en el último año.", family: "Hermana con hipotiroidismo.", medication: "Ninguno al ingreso." } },
    lastVisit: "2026-07-08", interval: 42, visits: 5,
    firstReason: "Cansancio, aumento de peso e intolerancia al frío de 6 meses de evolución",
    followReasons: ["Control de hipotiroidismo", "Revisión de TSH de control", "Ajuste de dosis de levotiroxina"],
    diagnoses: [dx("E03.9")],
    exam: ["Piel seca, edema palpebral leve. Reflejos osteotendinosos con relajación lenta. Tiroides no palpable.", "Piel levemente seca. Sin edema.", "Sin hallazgos positivos."],
    evolution: ["TSH 9.8 mUI/L (ingreso 14.2 mUI/L). Refiere más energía durante el día.", "TSH 4.1 mUI/L. Disminución de 2 kg de peso.", "TSH en rango normal. Asintomática."],
    plan: ["Levotiroxina 50 mcg en ayunas. TSH y T4 libre de control en 6 semanas.", "Ajuste de levotiroxina a 75 mcg en ayunas. TSH de control en 6 semanas.", "Continuar levotiroxina 75 mcg. TSH cada 6 meses."],
    prescriptions: [{ medication: "Levotiroxina", dose: "75 mcg", frequency: "1 tableta en ayunas", duration: "42 días" }],
    vitals: { bp: [122, 80, 118, 76], weight: [70.5, 67.8], height: 1.54, heartRate: 64 },
    referTo: { 0: "Laboratorio clínico" },
  },
  {
    patient: { id: "TC-021-2026", name: "Ingrid Paola Caal", age: 19, birthDate: "2007-02-14", municipality: "Tactic", phone: "5551 7745", bloodType: "O+", status: "Nuevo ingreso", allergies: [], chronicConditions: [], referredBy: socialWorker, history: { personal: "Niega enfermedades crónicas.", surgical: "Ninguno.", gyneco: "G0. Menarquia a los 12 años. Ciclos de 28 días, 5 días de duración, con dolor intenso.", family: "Madre con miomatosis uterina.", medication: "Ibuprofeno por automedicación." } },
    lastVisit: "2026-08-04", interval: 14, visits: 1,
    firstReason: "Dolor pélvico intenso durante la menstruación que limita actividades",
    followReasons: ["Revisión de ultrasonido pélvico"],
    diagnoses: [dx("N94.6")],
    exam: ["Dolor leve a la palpación profunda en hipogastrio, sin masas palpables."],
    evolution: [],
    plan: ["Naproxeno 550 mg cada 12 horas durante los días de dolor menstrual. Llevar calendario menstrual y de síntomas. Ultrasonido pélvico."],
    prescriptions: [{ medication: "Naproxeno", dose: "550 mg", frequency: "1 tableta cada 12 horas durante la menstruación", duration: "3 días por ciclo" }],
    vitals: { bp: [108, 68, 108, 68], weight: [52, 52], height: 1.57, heartRate: 80 },
  },
  {
    patient: { id: "SP-015-2026", name: "Reyna Magdalena Tut", age: 61, birthDate: "1965-05-19", municipality: "San Pedro Carchá", phone: "5558 3390", bloodType: "B+", status: "En tratamiento", allergies: ["Diclofenaco"], chronicConditions: ["Hipertensión arterial", "Gonartrosis"], referredBy: "Lic. Mario Cú · Trabajo Social", history: { personal: "Hipertensión arterial desde 2018.", surgical: "Ninguno.", gyneco: "G7 P7 C0 A0. Menopausia a los 50 años.", family: "Sin antecedentes relevantes.", medication: "Amlodipino 5 mg cada 24 horas." } },
    lastVisit: "2026-07-15", interval: 35, visits: 6, absentEvery: 4,
    firstReason: "Dolor en ambas rodillas al caminar y rigidez matutina",
    followReasons: ["Control de gonartrosis e hipertensión", "Seguimiento de dolor articular", "Control de presión arterial"],
    diagnoses: [dx("M17.9"), dx("I10")],
    exam: ["Crepitación bilateral de rodillas a la flexoextensión. Aumento de volumen leve en rodilla derecha.", "Crepitación bilateral. Sin derrame articular.", "Crepitación bilateral, arcos de movilidad conservados."],
    evolution: ["Disminución del dolor con acetaminofén y ejercicios. Persiste rigidez matutina de 15 minutos.", "Camina 20 minutos diarios con menos dolor. PA en metas.", "Dolor controlado. Buena adherencia a amlodipino."],
    plan: ["Acetaminofén 500 mg cada 8 horas. Amlodipino 5 mg cada 24 horas. Ejercicios de fortalecimiento de cuádriceps. Radiografía de rodillas.", "Continuar tratamiento. Reducción gradual de peso. Uso de calzado adecuado.", "Continuar amlodipino y analgesia por razón necesaria."],
    prescriptions: [{ medication: "Acetaminofén", dose: "500 mg", frequency: "1 tableta cada 8 horas", duration: "30 días" }, { medication: "Amlodipino", dose: "5 mg", frequency: "1 tableta cada 24 horas", duration: "30 días" }],
    vitals: { bp: [142, 88, 130, 80], weight: [74, 72.6], height: 1.49, heartRate: 76 },
  },
  {
    patient: { id: "CB-081-2026", name: "Lucía Fernanda Bol", age: 26, birthDate: "2000-10-03", municipality: "Cobán", phone: "5552 0918", bloodType: "Pendiente", status: "Nuevo ingreso", allergies: [], chronicConditions: [], referredBy: socialWorker, history: emptyHistory },
    lastVisit: TODAY, interval: 0, visits: 0,
    firstReason: "Evaluación médica general referida por Trabajo Social",
    followReasons: [], diagnoses: [], exam: [], evolution: [], plan: [], prescriptions: [],
    vitals: { bp: [0, 0, 0, 0], weight: [0, 0], height: 0, heartRate: 0 },
  },
]

const times = ["08:00", "08:45", "09:30", "10:15", "11:00", "13:00", "13:45", "14:30"]

function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const date = parseIso(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("es-GT", { ...options, timeZone: "UTC" }).format(parseIso(iso))
}

const pick = <T,>(items: T[], progress: number) => items[Math.min(items.length - 1, Math.floor(progress * items.length))]
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress
const round1 = (value: number) => Math.round(value * 10) / 10

function buildVisits(profile: ClinicalProfile, profileIndex: number): Omit<Consultation, "id">[] {
  const { patient, visits, interval, lastVisit, vitals } = profile
  return Array.from({ length: visits }, (_, k) => {
    const progress = visits > 1 ? k / (visits - 1) : 0
    const isoDate = addDays(lastVisit, -interval * (visits - 1 - k))
    const absent = Boolean(profile.absentEvery && k > 0 && k < visits - 1 && k % profile.absentEvery === 0)
    const wobble = (k % 3) - 1
    const base = {
      isoDate,
      dateLabel: formatDate(isoDate),
      time: times[(k + profileIndex) % times.length],
      patientId: patient.id,
      patientName: patient.name,
      reason: k === 0 ? profile.firstReason : pick(profile.followReasons, (k - 1) / Math.max(1, visits - 2)),
      type: (k === 0 ? "Primera consulta" : "Reconsulta") as ConsultationType,
      place: CLINICS[(k + profileIndex) % 5 === 0 ? 1 : 0],
    }
    if (absent) return { ...base, status: "Ausente" as const }
    const [temperatureStart, temperatureEnd] = vitals.temperature ?? [36.6, 36.5]
    return {
      ...base,
      status: "Atendida" as const,
      professional: PROFESSIONAL,
      vitals: {
        systolic: Math.round(lerp(vitals.bp[0], vitals.bp[2], progress)) + wobble * 2,
        diastolic: Math.round(lerp(vitals.bp[1], vitals.bp[3], progress)) + wobble,
        heartRate: vitals.heartRate + ((k * 7) % 5) - 2,
        respiratoryRate: 16 + (k % 3),
        temperature: round1(lerp(temperatureStart, temperatureEnd, Math.min(1, progress * 2)) + (vitals.temperature ? 0 : wobble * 0.1)),
        oxygenSaturation: 97 + (k % 2),
        weight: round1(lerp(vitals.weight[0], vitals.weight[1], progress)),
        height: vitals.height,
      },
      physicalExam: pick(profile.exam, progress),
      diagnoses: profile.diagnoses,
      plan: pick(profile.plan, progress),
      prescriptions: profile.prescriptions,
      evolution: k === 0 ? undefined : pick(profile.evolution, (k - 1) / Math.max(1, visits - 2)),
      referral: profile.referTo?.[k],
    }
  })
}

const scheduleSlots: { patientId: string; isoDate: string; time: string; place?: string }[] = [
  { patientId: "CB-078-2026", isoDate: "2026-08-18", time: "08:00" },
  { patientId: "SC-019-2026", isoDate: "2026-08-18", time: "08:45" },
  { patientId: "TC-021-2026", isoDate: "2026-08-18", time: "09:30" },
  { patientId: "SP-011-2026", isoDate: "2026-08-18", time: "10:15", place: CLINICS[1] },
  { patientId: "CB-066-2026", isoDate: "2026-08-18", time: "11:00" },
  { patientId: "CB-081-2026", isoDate: "2026-08-18", time: "13:00" },
  { patientId: "SC-027-2026", isoDate: "2026-08-19", time: "08:00" },
  { patientId: "SP-015-2026", isoDate: "2026-08-19", time: "09:30" },
  { patientId: "CB-056-2026", isoDate: "2026-08-20", time: "08:45" },
  { patientId: "SP-011-2026", isoDate: "2026-09-01", time: "10:15", place: CLINICS[1] },
  { patientId: "CB-066-2026", isoDate: "2026-09-08", time: "11:00" },
]

const history = profiles
  .flatMap((profile, index) => buildVisits(profile, index))
  .sort((a, b) => `${a.isoDate}${a.time}`.localeCompare(`${b.isoDate}${b.time}`))
  .map((item, index) => ({ ...item, id: `CON-${String(index + 1).padStart(4, "0")}` }))

const upcoming: Consultation[] = scheduleSlots.map((slot, index) => {
  const profile = profiles.find((item) => item.patient.id === slot.patientId) as ClinicalProfile
  const isFirst = profile.visits === 0
  return {
    id: `CON-${String(history.length + index + 1).padStart(4, "0")}`,
    isoDate: slot.isoDate,
    dateLabel: formatDate(slot.isoDate),
    time: slot.time,
    patientId: profile.patient.id,
    patientName: profile.patient.name,
    reason: isFirst ? profile.firstReason : profile.followReasons[0],
    type: isFirst ? "Primera consulta" : "Reconsulta",
    place: slot.place ?? CLINICS[0],
    status: "Programada",
  }
})

export const consultations: Consultation[] = [...history, ...upcoming].sort((a, b) =>
  `${a.isoDate}${a.time}`.localeCompare(`${b.isoDate}${b.time}`),
)

export const medPatients: MedPatient[] = profiles.map((profile) => {
  const first = consultations.find((item) => item.patientId === profile.patient.id)
  return { ...profile.patient, referredOn: addDays(first?.isoDate ?? TODAY, -5) }
})

export const medReferrals: MedReferral[] = [
  { id: "REF-TS-112", patientId: "CB-073-2026", patientName: "Juana Isabel Choc", age: 36, municipality: "Cobán", received: "Hoy · 08:15", reason: "Dolor abdominal recurrente y pérdida de peso", priority: "Alta", socialWorker: "Licda. Karla Rodas", note: "Refiere dolor abdominal desde hace 2 meses y pérdida de peso no intencionada. Se solicita evaluación médica prioritaria." },
  { id: "REF-TS-110", patientId: "TC-014-2026", patientName: "Patricia Alejandra Ical", age: 44, municipality: "Tactic", received: "Ayer · 15:40", reason: "Control de presión arterial", priority: "Media", socialWorker: "Licda. Karla Rodas", note: "Indica diagnóstico previo de hipertensión sin tratamiento actual por falta de recursos." },
  { id: "REF-TS-107", patientId: "SP-019-2026", patientName: "Heidy Marisol Quej", age: 30, municipality: "San Pedro Carchá", received: "14 ago · 10:20", reason: "Evaluación médica general", priority: "Baja", socialWorker: "Lic. Mario Cú", note: "Evaluación de rutina como parte del plan de atención integral." },
]

export function findPatient(id: string) {
  return medPatients.find((item) => item.id === id)
}

export function patientConsultations(id: string) {
  return consultations.filter((item) => item.patientId === id)
}

export function lastAttended(id: string, before = "9999-12-31") {
  return patientConsultations(id)
    .filter((item) => item.status === "Atendida" && item.isoDate < before)
    .at(-1)
}

export function nextScheduled(id: string) {
  return patientConsultations(id).find((item) => item.status === "Programada")
}

export function bmi(weight: number, height: number) {
  if (!weight || !height) return null
  return round1(weight / (height * height))
}

export function bmiCategory(value: number) {
  if (value < 18.5) return "Bajo peso"
  if (value < 25) return "Normal"
  if (value < 30) return "Sobrepeso"
  return "Obesidad"
}

export function historySummary(history: MedicalHistory) {
  return [history.personal, history.surgical !== "Ninguno." ? `Qx: ${history.surgical}` : "", history.family]
    .filter(Boolean)
    .join(" ")
}
