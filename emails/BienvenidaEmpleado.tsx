import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
} from '@react-email/components';

interface BienvenidaEmpleadoProps {
  nombre: string;
  documento_id: string;
  email: string;
  rol: string;
  nivel_acceso: number;
  pin_seguridad: string;
}

export const BienvenidaEmpleado = ({
  nombre,
  documento_id,
  email,
  rol,
  nivel_acceso,
  pin_seguridad,
}: BienvenidaEmpleadoProps) => {
  const previewText = `Bienvenido al sistema, ${nombre}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Encabezado */}
          <Section style={header}>
            <Text style={headerTitle}>GESTOR DE ACCESO</Text>
            <Text style={headerSubtitle}>Sistema de Control de Personal</Text>
          </Section>

          {/* Datos del empleado */}
          <Section style={dataSection}>
            <Text style={dataTitle}>📋 DATOS DEL EMPLEADO</Text>
            <table style={dataTable}>
              <tr>
                <td style={dataLabel}>Nombre:</td>
                <td style={dataValue}>{nombre}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Documento:</td>
                <td style={dataValue}>{documento_id}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Email:</td>
                <td style={dataValue}>{email}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Rol:</td>
                <td style={dataValue}>{rol}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Nivel de acceso:</td>
                <td style={dataValue}>{nivel_acceso}</td>
              </tr>
            </table>
          </Section>

          {/* PIN de seguridad */}
          <Section style={pinSection}>
            <Text style={pinLabel}>🔐 PIN DE SEGURIDAD</Text>
            <Text style={pinValue}>{pin_seguridad}</Text>
            <Text style={pinWarning}>
              Este PIN es personal e intransferible. No lo compartas con nadie.
            </Text>
          </Section>

          {/* Reglas y procedimientos */}
          <Section style={rulesSection}>
            <Text style={rulesTitle}>📌 NORMAS Y PROCEDIMIENTOS OBLIGATORIOS</Text>
            <Text style={rulesText}>
              Como parte de nuestra política de control de acceso, es fundamental que todos los empleados registren su entrada y salida en el sistema. A continuación, las pautas que debes seguir:
            </Text>
            <ul style={rulesList}>
              <li style={listItem}>
                <strong>Registro de entrada:</strong> Debes escanear tu código QR en el lector ubicado en la entrada principal cada vez que ingreses a las instalaciones. El sistema validará tu ubicación GPS y te permitirá acceder solo si te encuentras dentro del rango permitido.
              </li>
              <li style={listItem}>
                <strong>Registro de salida:</strong> Al finalizar tu jornada, deberás escanear nuevamente tu QR para registrar tu salida. Esto es obligatorio para llevar un control preciso de horas trabajadas y para fines de seguridad.
              </li>
              <li style={listItem}>
                <strong>Obligatoriedad:</strong> El incumplimiento del registro de entrada o salida será considerado como falta grave y podrá ser sancionado según el reglamento interno.
              </li>
              <li style={listItem}>
                <strong>Confidencialidad:</strong> Tu código QR y PIN son personales. No los compartas ni permitas que otra persona los utilice. Cualquier uso indebido será responsabilidad del titular.
              </li>
              <li style={listItem}>
                <strong>Actualización de datos:</strong> Si cambias de teléfono o tienes problemas con el GPS, notifica de inmediato a tu supervisor para que se tomen las medidas necesarias.
              </li>
            </ul>
            <Text style={rulesFooter}>
              Al hacer uso de este sistema, aceptas cumplir con estas normas y entiendes que tu presencia queda registrada para efectos administrativos y de seguridad.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Pie de página */}
          <Section style={footer}>
            <Text style={footerText}>
              Este es un mensaje automático del Sistema de Gestión de Acceso. Por favor, no respondas a este correo.
            </Text>
            <Text style={footerText}>
              © 2026 Gestor de Acceso. Todos los derechos reservados.
            </Text>
            <Text style={footerSmall}>
              Documento generado el {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BienvenidaEmpleado;

// Estilos (en línea, formato React Email)
const main = {
  backgroundColor: '#f4f4f4',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '20px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  width: '100%',
  maxWidth: '210mm', // A4 width
  padding: '10mm',   // 1 cm = 10mm
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
  color: '#1e293b',
  margin: '0 0 4px',
};

const headerSubtitle = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0',
};

const dataSection = {
  marginBottom: '24px',
};

const dataTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 12px',
  borderBottom: '2px solid #e2e8f0',
  paddingBottom: '6px',
};

const dataTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const dataLabel = {
  padding: '8px 12px',
  backgroundColor: '#f8fafc',
  fontWeight: '600',
  color: '#334155',
  width: '30%',
  border: '1px solid #e2e8f0',
};

const dataValue = {
  padding: '8px 12px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
};

const pinSection = {
  backgroundColor: '#1e293b',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const pinLabel = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#94a3b8',
  letterSpacing: '1px',
  margin: '0 0 8px',
};

const pinValue = {
  fontSize: '32px',
  fontWeight: 'bold',
  color: '#fbbf24',
  fontFamily: 'monospace',
  margin: '0 0 8px',
};

const pinWarning = {
  fontSize: '12px',
  color: '#cbd5e1',
  fontStyle: 'italic' as const,
  margin: '0',
};

const rulesSection = {
  marginBottom: '24px',
};

const rulesTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 12px',
  borderBottom: '2px solid #e2e8f0',
  paddingBottom: '6px',
};

const rulesText = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#334155',
  margin: '0 0 16px',
};

const rulesList = {
  listStyleType: 'none',
  padding: '0',
  margin: '0 0 16px',
};

const listItem = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#334155',
  marginBottom: '12px',
  paddingLeft: '20px',
  position: 'relative' as const,
};

const rulesFooter = {
  fontSize: '14px',
  fontStyle: 'italic' as const,
  color: '#475569',
  margin: '16px 0 0',
  padding: '12px',
  backgroundColor: '#f1f5f9',
  borderRadius: '4px',
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