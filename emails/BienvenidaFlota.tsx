import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from '@react-email/components';

interface BienvenidaFlotaProps {
  nombre_completo: string;
  documento_id: string;
  nombre_flota: string;
  cant_choferes: number;
  cant_rutas: number;
  pin_secreto: string;
  email: string;
}

export const BienvenidaFlota = ({
  nombre_completo,
  documento_id,
  nombre_flota,
  cant_choferes,
  cant_rutas,
  pin_secreto,
  email,
}: BienvenidaFlotaProps) => {
  const previewText = `Bienvenido al sistema de flota, ${nombre_completo}`;
  const fechaActual = new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Encabezado */}
          <Section style={header}>
            <Text style={headerTitle}>🚛 GESTOR DE FLOTA</Text>
            <Text style={headerSubtitle}>Sistema de Control de Acceso para Transporte</Text>
          </Section>

          {/* DATOS DEL CONDUCTOR */}
          <Section style={dataSection}>
            <Text style={dataTitle}>📋 DATOS DEL CONDUCTOR</Text>
            <table style={dataTable}>
              <tr>
                <td style={dataLabel}>Documento de Identidad:</td>
                <td style={dataValue}><strong>{documento_id}</strong></td>
              </tr>
              <tr>
                <td style={dataLabel}>PIN Secreto de Acceso:</td>
                <td style={dataValue}><strong style={pinHighlight}>{pin_secreto}</strong></td>
              </tr>
              <tr>
                <td style={dataLabel}>Nombre de la Flota:</td>
                <td style={dataValue}>{nombre_flota || 'No especificada'}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Fecha de Creación:</td>
                <td style={dataValue}>{fechaActual}</td>
              </tr>
            </table>
            <Text style={warning}>
              ⚠️ <strong>IMPORTANTE:</strong> Este PIN es personal e intransferible. No lo compartas con nadie.
            </Text>
          </Section>

          {/* SEGURIDAD EN LAS INSTALACIONES */}
          <Section style={section}>
            <Text style={sectionTitle}>🏭 SEGURIDAD EN LAS INSTALACIONES</Text>
            
            <Text style={subsectionTitle}>⚠️ RIESGOS DENTRO DEL ALMACÉN</Text>
            <table style={riskTable}>
              <tr>
                <td style={riskLabel}>Espacios reducidos</td>
                <td style={riskDesc}>Las áreas de maniobra son limitadas. Circula a velocidad mínima (5 km/h).</td>
              </tr>
              <tr>
                <td style={riskLabel}>Gases tóxicos</td>
                <td style={riskDesc}>Motores encendidos en áreas cerradas pueden acumular CO2. Apaga siempre el motor.</td>
              </tr>
              <tr>
                <td style={riskLabel}>Superficies resbaladizas</td>
                <td style={riskDesc}>Posibles derrames de aceite o combustible. Precaución al caminar.</td>
              </tr>
              <tr>
                <td style={riskLabel}>Zonas de carga</td>
                <td style={riskDesc}>Áreas con movimiento constante de personal y maquinaria.</td>
              </tr>
            </table>

            <div style={doDontContainer}>
              <div style={doBox}>
                <Text style={doDontTitle}>✅ LO QUE SÍ DEBES HACER</Text>
                <ul style={list}>
                  <li>Respetar señales de tránsito interno</li>
                  <li>Usar siempre el cinturón de seguridad</li>
                  <li>Mantener luces bajas encendidas</li>
                  <li>Respetar prioridad peatonal</li>
                  <li>Reportar incidentes inmediatamente</li>
                </ul>
              </div>
              <div style={dontBox}>
                <Text style={doDontTitle}>❌ LO QUE NO DEBES HACER</Text>
                <ul style={list}>
                  <li>Exceder velocidad de 5 km/h</li>
                  <li>Estacionar en zonas no designadas</li>
                  <li>Dejar motor encendido en áreas cerradas</li>
                  <li>Usar teléfono mientras conduces</li>
                  <li>Fumar dentro de las instalaciones</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* APARCAMIENTO EN BAHÍAS */}
          <Section style={section}>
            <Text style={sectionTitle}>🅿️ APARCAMIENTO EN BAHÍAS DE CARGA</Text>
            
            <div style={procedureBox}>
              <Text style={procedureStep}><strong>1. ACERCAMIENTO</strong></Text>
              <Text style={procedureDetail}>└── Velocidad máxima: 5 km/h</Text>
              <Text style={procedureDetail}>└── Señalizar con direccionales</Text>
              
              <Text style={procedureStep}><strong>2. POSICIONAMIENTO</strong></Text>
              <Text style={procedureDetail}>└── Alinear el vehículo con las marcas del piso</Text>
              <Text style={procedureDetail}>└── Distancia máxima al andén: 15 cm</Text>
              <Text style={procedureDetail}>└── Activar freno de mano</Text>
              
              <Text style={procedureStep}><strong>3. DESCARGA/CARGA</strong></Text>
              <Text style={procedureDetail}>└── Calzar ruedas si es necesario</Text>
              <Text style={procedureDetail}>└── Apagar motor completamente</Text>
              <Text style={procedureDetail}>└── Usar balizas</Text>
              
              <Text style={procedureStep}><strong>4. RETIRADA</strong></Text>
              <Text style={procedureDetail}>└── Verificar espejos laterales</Text>
              <Text style={procedureDetail}>└── Ceder paso a peatones</Text>
              <Text style={procedureDetail}>└── Salir en reversa con ayuda si es necesario</Text>
            </div>
          </Section>

          {/* MANEJO DE LA CARGA */}
          <Section style={section}>
            <Text style={sectionTitle}>📦 MANEJO DE LA CARGA</Text>
            
            <table style={cargoTable}>
              <tr>
                <th style={tableHeader}>Acción</th>
                <th style={tableHeader}>Correcto</th>
                <th style={tableHeader}>Incorrecto</th>
              </tr>
              <tr>
                <td style={tableCell}><strong>Asegurar carga</strong></td>
                <td style={tableCell}>Usar cinchas y topes</td>
                <td style={tableCellIncorrect}>Carga suelta</td>
              </tr>
              <tr>
                <td style={tableCell}><strong>Estiba</strong></td>
                <td style={tableCell}>Distribuir peso uniformemente</td>
                <td style={tableCellIncorrect}>Sobrecargar un lado</td>
              </tr>
              <tr>
                <td style={tableCell}><strong>Altura máxima</strong></td>
                <td style={tableCell}>Respetar límite del vehículo</td>
                <td style={tableCellIncorrect}>Exceder altura permitida</td>
              </tr>
              <tr>
                <td style={tableCell}><strong>Protección</strong></td>
                <td style={tableCell}>Usar esquineros y protectores</td>
                <td style={tableCellIncorrect}>Carga sin protección</td>
              </tr>
            </table>

            <Text style={subsectionTitle}>Pasos para una carga segura:</Text>
            <ol style={list}>
              <li><strong>INSPECCIÓN:</strong> Revisar que la carga esté en buen estado</li>
              <li><strong>PLANIFICACIÓN:</strong> Distribuir según peso y destino</li>
              <li><strong>SUJECIÓN:</strong> Verificar amarres antes de movilizar</li>
              <li><strong>DOCUMENTACIÓN:</strong> Confirmar que la guía coincida con la carga</li>
            </ol>
          </Section>

          {/* ORDEN Y LIMPIEZA */}
          <Section style={section}>
            <Text style={sectionTitle}>🧹 ORDEN Y LIMPIEZA</Text>
            
            <div style={doDontContainer}>
              <div style={doBox}>
                <Text style={doDontTitle}>✅ ANTES DE SALIR</Text>
                <ul style={list}>
                  <li>Barrer la zona de carga</li>
                  <li>Recoger restos de flejes</li>
                  <li>Devolver jaulas y pallets</li>
                  <li>Reportar derrames</li>
                  <li>Colocar calzos en su lugar</li>
                </ul>
              </div>
              <div style={dontBox}>
                <Text style={doDontTitle}>❌ NUNCA DEJES</Text>
                <ul style={list}>
                  <li>Basura en el piso</li>
                  <li>Envases vacíos</li>
                  <li>Jaulas en pasillos</li>
                  <li>Manchas de aceite</li>
                  <li>Herramientas tiradas</li>
                </ul>
              </div>
            </div>

            <Text style={text}><strong>Ubicación de elementos:</strong></Text>
            <ul style={list}>
              <li><strong>Jaulas vacías:</strong> Zona E-3 (marcada con amarillo)</li>
              <li><strong>Pallets:</strong> Almacén de retorno, sector A</li>
              <li><strong>Residuos:</strong> Contenedores en bahía 5</li>
            </ul>
          </Section>

          {/* ADVERTENCIAS */}
          <Section style={warningSection}>
            <Text style={warningTitle}>🔴 ALTO - Detención inmediata</Text>
            <ul style={warningList}>
              <li>Derrame de combustible o químicos</li>
              <li>Presencia de personal no autorizado en zona de maniobras</li>
              <li>Luces de emergencia activadas</li>
              <li>Condiciones climáticas adversas (lluvia intensa)</li>
            </ul>
          </Section>

          <Section style={cautionSection}>
            <Text style={cautionTitle}>🟡 PRECAUCIÓN - Atención especial cuando:</Text>
            <ul style={warningList}>
              <li>Haya personal realizando mantenimiento</li>
              <li>Se estén moviendo cargas suspendidas</li>
              <li>Operen montacargas cercanos</li>
              <li>Visibilidad reducida por niebla o polvo</li>
            </ul>
          </Section>

          {/* CONTACTOS DE EMERGENCIA */}
          <Section style={section}>
            <Text style={sectionTitle}>📞 CONTACTOS DE EMERGENCIA</Text>
            <div style={emergencyGrid}>
              <div style={emergencyItem}>
                <Text style={emergencyLabel}>Accidente</Text>
                <Text style={emergencyNumber}>Jefe de Patio - 101</Text>
              </div>
              <div style={emergencyItem}>
                <Text style={emergencyLabel}>Derrame químico</Text>
                <Text style={emergencyNumber}>Seguridad - 102</Text>
              </div>
              <div style={emergencyItem}>
                <Text style={emergencyLabel}>Emergencia médica</Text>
                <Text style={emergencyNumber}>Enfermería - 103</Text>
              </div>
              <div style={emergencyItem}>
                <Text style={emergencyLabel}>Incendio</Text>
                <Text style={emergencyNumber}>Brigada - 104</Text>
              </div>
            </div>
          </Section>

          {/* FIRMA */}
          <Section style={signatureSection}>
            <Text style={quote}>🏆</Text>
            <Text style={quote}>
              "Un almacén seguro y ordenado es responsabilidad de todos. Tu compromiso con las normas protege tu vida, la de tus compañeros y la integridad de la carga."
            </Text>
            
            <Text style={signatureTitle}>📝 FIRMA DE ENTERADO</Text>
            <Text style={text}>Por favor, confirma la recepción de este correo y tu compromiso con las normas respondiendo a este mensaje con:</Text>
            <div style={signatureBox}>
              <Text style={signatureText}>
                "He leído y acepto cumplir con todos los protocolos de seguridad establecidos"
              </Text>
            </div>
          </Section>

          <Hr style={hr} />

          {/* Pie de página */}
          <Section style={footer}>
            <Text style={footerText}>
              Este es un mensaje automático del Sistema de Gestión de Flota. Por favor, no respondas a este correo.
            </Text>
            <Text style={footerText}>
              © 2026 Gestor de Acceso. Todos los derechos reservados.
            </Text>
            <Text style={footerSmall}>
              Documento generado el {fechaActual}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BienvenidaFlota;

// Estilos
const main = {
  backgroundColor: '#f4f4f4',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '20px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  width: '100%',
  maxWidth: '210mm',
  padding: '10mm',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  borderRadius: '8px',
};

const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const headerTitle = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#059669',
  margin: '0 0 4px',
};

const headerSubtitle = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0',
};

const dataSection = {
  marginBottom: '24px',
  backgroundColor: '#f8fafc',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const dataTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#059669',
  margin: '0 0 12px',
  borderBottom: '2px solid #059669',
  paddingBottom: '6px',
};

const dataTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginBottom: '12px',
};

const dataLabel = {
  padding: '8px 12px',
  backgroundColor: '#f1f5f9',
  fontWeight: '600',
  color: '#334155',
  width: '40%',
  border: '1px solid #cbd5e1',
};

const dataValue = {
  padding: '8px 12px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
};

const pinHighlight = {
  color: '#059669',
  fontSize: '16px',
  letterSpacing: '2px',
};

const warning = {
  fontSize: '13px',
  color: '#dc2626',
  backgroundColor: '#fee2e2',
  padding: '10px',
  borderRadius: '4px',
  margin: '12px 0 0',
  border: '1px solid #fecaca',
};

const section = {
  marginBottom: '24px',
};

const sectionTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 12px',
  borderBottom: '2px solid #e2e8f0',
  paddingBottom: '6px',
};

const subsectionTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#334155',
  margin: '16px 0 8px',
};

const riskTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginBottom: '16px',
};

const riskLabel = {
  padding: '8px 12px',
  backgroundColor: '#fee2e2',
  fontWeight: '600',
  color: '#991b1b',
  width: '25%',
  border: '1px solid #fecaca',
};

const riskDesc = {
  padding: '8px 12px',
  backgroundColor: '#fff',
  color: '#334155',
  border: '1px solid #e2e8f0',
};

const doDontContainer = {
  display: 'flex',
  gap: '16px',
  marginBottom: '16px',
};

const doBox = {
  flex: 1,
  backgroundColor: '#dcfce7',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #86efac',
};

const dontBox = {
  flex: 1,
  backgroundColor: '#fee2e2',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #fecaca',
};

const doDontTitle = {
  fontSize: '14px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 8px',
};

const list = {
  margin: '0',
  paddingLeft: '20px',
};

const procedureBox = {
  backgroundColor: '#f1f5f9',
  padding: '16px',
  borderRadius: '8px',
  fontFamily: 'monospace',
};

const procedureStep = {
  fontSize: '14px',
  margin: '8px 0 2px',
};

const procedureDetail = {
  fontSize: '13px',
  color: '#475569',
  margin: '0 0 2px 16px',
};

const cargoTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginBottom: '16px',
};

const tableHeader = {
  padding: '8px 12px',
  backgroundColor: '#059669',
  color: 'white',
  border: '1px solid #047857',
  fontSize: '12px',
};

const tableCell = {
  padding: '8px 12px',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
};

const tableCellIncorrect = {
  padding: '8px 12px',
  backgroundColor: '#fee2e2',
  border: '1px solid #fecaca',
  color: '#991b1b',
};

const text = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#334155',
  margin: '8px 0',
};

const warningSection = {
  backgroundColor: '#fee2e2',
  borderLeft: '4px solid #dc2626',
  padding: '12px',
  marginBottom: '16px',
  borderRadius: '4px',
};

const warningTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#991b1b',
  margin: '0 0 8px',
};

const cautionSection = {
  backgroundColor: '#fef9c3',
  borderLeft: '4px solid #eab308',
  padding: '12px',
  marginBottom: '16px',
  borderRadius: '4px',
};

const cautionTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#854d0e',
  margin: '0 0 8px',
};

const warningList = {
  margin: '0',
  paddingLeft: '20px',
  color: '#334155',
};

const emergencyGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
  marginTop: '8px',
};

const emergencyItem = {
  backgroundColor: '#1e293b',
  color: 'white',
  padding: '8px',
  borderRadius: '4px',
};

const emergencyLabel = {
  fontSize: '11px',
  fontWeight: 'bold',
  margin: '0',
  color: '#94a3b8',
};

const emergencyNumber = {
  fontSize: '13px',
  fontWeight: 'bold',
  margin: '4px 0 0',
};

const signatureSection = {
  backgroundColor: '#f0fdf4',
  padding: '16px',
  borderRadius: '8px',
  marginBottom: '24px',
  border: '2px dashed #059669',
};

const quote = {
  fontSize: '14px',
  fontStyle: 'italic' as const,
  textAlign: 'center' as const,
  color: '#059669',
  margin: '8px 0',
};

const signatureTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#059669',
  textAlign: 'center' as const,
  margin: '16px 0 8px',
};

const signatureBox = {
  backgroundColor: '#059669',
  padding: '12px',
  borderRadius: '8px',
  marginTop: '8px',
};

const signatureText = {
  color: 'white',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0',
  fontSize: '14px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const footer = {
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#64748b',
  margin: '4px 0',
};

const footerSmall = {
  fontSize: '10px',
  color: '#94a3b8',
  margin: '8px 0 0',
};