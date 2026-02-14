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

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Encabezado */}
          <Section style={header}>
            <Text style={headerTitle}>GESTOR DE FLOTA</Text>
            <Text style={headerSubtitle}>Sistema de Control de Acceso para Transporte</Text>
          </Section>

          {/* Datos del perfil */}
          <Section style={dataSection}>
            <Text style={dataTitle}>🚛 DATOS DEL CHOFER / FLOTA</Text>
            <table style={dataTable}>
              <tr>
                <td style={dataLabel}>Nombre completo:</td>
                <td style={dataValue}>{nombre_completo}</td>
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
                <td style={dataLabel}>Flota / Empresa:</td>
                <td style={dataValue}>{nombre_flota || 'No especificada'}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Cantidad de choferes:</td>
                <td style={dataValue}>{cant_choferes}</td>
              </tr>
              <tr>
                <td style={dataLabel}>Rutas asignadas:</td>
                <td style={dataValue}>{cant_rutas}</td>
              </tr>
            </table>
          </Section>

          {/* PIN de seguridad */}
          <Section style={pinSection}>
            <Text style={pinLabel}>🔐 PIN DE SEGURIDAD (FLOTA)</Text>
            <Text style={pinValue}>{pin_secreto}</Text>
            <Text style={pinWarning}>
              Este PIN es confidencial e intransferible. No lo compartas con nadie.
            </Text>
          </Section>

          {/* Reglas y procedimientos para flota */}
          <Section style={rulesSection}>
            <Text style={rulesTitle}>📌 NORMAS Y PROCEDIMIENTOS PARA FLOTA</Text>
            <Text style={rulesText}>
              Para garantizar la seguridad y el control de las operaciones, todos los choferes y vehículos deben registrar su entrada y salida del patio. A continuación, las pautas que debes seguir:
            </Text>
            <ul style={rulesList}>
              <li style={listItem}>
                <strong>Registro de llegada:</strong> Al ingresar al patio, debes presentar tu código QR en el lector. El sistema registrará la hora de llegada y validará que te encuentres en la ubicación autorizada.
              </li>
              <li style={listItem}>
                <strong>Registro de salida:</strong> Antes de partir, deberás escanear nuevamente tu QR. En ese momento, deberás ingresar la cantidad de carga real y cualquier observación relevante. Esto es obligatorio para el control de despachos.
              </li>
              <li style={listItem}>
                <strong>Obligatoriedad:</strong> El incumplimiento del registro de entrada o salida será considerado una falta y podrá afectar la programación de futuras rutas.
              </li>
              <li style={listItem}>
                <strong>Responsabilidad:</strong> Tu código QR y PIN son personales. No los prestes ni permitas que otro conductor los utilice. Cualquier irregularidad será responsabilidad del titular.
              </li>
              <li style={listItem}>
                <strong>Exactitud de datos:</strong> Al registrar la salida, asegúrate de que la cantidad de carga y las observaciones sean correctas. Esto es fundamental para la auditoría y facturación.
              </li>
              <li style={listItem}>
                <strong>Mantenimiento del perfil:</strong> Si cambias de vehículo, flota o datos de contacto, notifica a la administración para actualizar tu perfil.
              </li>
            </ul>
            <Text style={rulesFooter}>
              Al utilizar este sistema, aceptas cumplir con estas normas y entiendes que tu presencia en el patio queda registrada para efectos de control y seguridad.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Pie de página */}
          <Section style={footer}>
            <Text style={footerText}>
              Este es un mensaje automático del Sistema de Gestión de Flota. No respondas a este correo.
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

export default BienvenidaFlota;

// Estilos (idénticos a los de empleado, se pueden compartir, pero por claridad los repetimos)
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