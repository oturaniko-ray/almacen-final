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
  // ✅ AÑADIR ESTAS DOS PROPS
  telegramLink?: string;
  telegramToken?: string;
}

export const BienvenidaFlota = ({
  nombre_completo,
  documento_id,
  nombre_flota,
  cant_choferes,
  cant_rutas,
  pin_secreto,
  email,
  // ✅ RECIBIR LAS PROPS
  telegramLink,
  telegramToken,
}: BienvenidaFlotaProps) => {
  const previewText = `Bienvenido al sistema de flota, ${nombre_completo}`;
  const fechaActual = new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const appUrl = 'https://almacen-final.vercel.app/';
  const telegramDownloadUrl = 'https://telegram.org/apps';

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

          {/* Mensaje de bienvenida */}
          <Section style={welcomeSection}>
            <Text style={welcomeText}>
              🎉 ¡Bienvenido, <strong>{nombre_completo}</strong>!
            </Text>
            <Text style={welcomeDescription}>
              Tu perfil de flota ha sido registrado exitosamente. Cuando un supervisor registre tu ingreso, necesitarás tus credenciales.
            </Text>
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

          {/* SECCIÓN TELEGRAM - BOTONES LADO A LADO */}
          <Section style={telegramSection}>
            <Text style={telegramTitle}>📱 CANAL DE COMUNICACIÓN OFICIAL</Text>
            <div style={telegramButtonsContainer}>
              {telegramLink ? (
                <a href={telegramLink} style={telegramButton}>
                  🔗 VINCULAR CON TELEGRAM
                </a>
              ) : (
                <a href={telegramDownloadUrl} style={telegramDownloadButton}>
                  📲 DESCARGAR TELEGRAM
                </a>
              )}
              {telegramToken && (
                <Text style={telegramTokenStyle}>
                  Token: <strong>{telegramToken}</strong>
                </Text>
              )}
            </div>
            <Text style={telegramHint}>
              * Una vez vinculado, recibirás notificaciones automáticas.
            </Text>
          </Section>

          {/* Link de acceso destacado */}
          <Section style={linkSection}>
            <Text style={linkLabel}>📍 SISTEMA DE ACCESO</Text>
            <a href={appUrl} style={linkButton}>
              {appUrl}
            </a>
            <Text style={linkHint}>
              Haz clic para acceder a la plataforma
            </Text>
          </Section>

          {/* Instrucciones para flota */}
          <Section style={instructionsSection}>
            <Text style={instructionsTitle}>📱 ¿CÓMO FUNCIONA?</Text>
            <div style={instructionsBox}>
              <div style={instructionItem}>
                <span style={instructionNumber}>1</span>
                <span style={instructionText}>Cuando llegues al almacén, un supervisor registrará tu ingreso</span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>2</span>
                <span style={instructionText}>Deberás presentar tu <strong>Documento de Identidad</strong></span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>3</span>
                <span style={instructionText}>El supervisor verificará tus datos en el sistema</span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>4</span>
                <span style={instructionText}>Tu <strong>PIN</strong> es solo por seguridad, no lo necesitas para ingresar</span>
              </div>
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

// =====================================================
// ESTILOS
// =====================================================
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

const welcomeSection = {
  backgroundColor: '#e6f7e6',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px',
  border: '1px solid #b8e0b8',
};

const welcomeText = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#065f46',
  margin: '0 0 8px',
};

const welcomeDescription = {
  fontSize: '14px',
  color: '#334155',
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

// =====================================================
// ESTILOS DE TELEGRAM
// =====================================================
const telegramSection = {
  marginBottom: '24px',
  padding: '16px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
};

const telegramTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const telegramButtonsContainer = {
  display: 'flex',
  justifyContent: 'center',
  gap: '16px',
  marginBottom: '12px',
};

const telegramButton = {
  display: 'inline-block',
  backgroundColor: '#0088cc',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '30px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  boxShadow: '0 4px 6px rgba(0, 136, 204, 0.3)',
  textAlign: 'center' as const,
};

const telegramDownloadButton = {
  display: 'inline-block',
  backgroundColor: '#2AABEE',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '30px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  boxShadow: '0 4px 6px rgba(42, 171, 238, 0.3)',
  textAlign: 'center' as const,
};

const telegramTokenStyle = {
  fontSize: '12px',
  color: '#4b5563',
  backgroundColor: '#ffffff',
  padding: '6px 12px',
  borderRadius: '20px',
  display: 'inline-block',
  margin: '8px 0 0',
  fontFamily: 'monospace',
  border: '1px solid #0088cc',
};

const telegramHint = {
  fontSize: '11px',
  color: '#6b7280',
  fontStyle: 'italic' as const,
  margin: '8px 0 0',
  textAlign: 'center' as const,
};

const linkSection = {
  backgroundColor: '#f0f9ff',
  padding: '16px',
  borderRadius: '8px',
  marginBottom: '24px',
  textAlign: 'center' as const,
  border: '1px solid #7ab3ff',
};

const linkLabel = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#1e40af',
  letterSpacing: '1px',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
};

const linkButton = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '14px 24px',
  borderRadius: '30px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  marginBottom: '8px',
  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)',
};

const linkHint = {
  fontSize: '12px',
  color: '#4b5563',
  fontStyle: 'italic' as const,
  margin: '8px 0 0',
};

const instructionsSection = {
  marginBottom: '24px',
  backgroundColor: '#f8fafc',
  padding: '16px',
  borderRadius: '8px',
};

const instructionsTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const instructionsBox = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px',
};

const instructionItem = {
  display: 'flex',
  alignItems: 'center' as const,
  gap: '12px',
};

const instructionNumber = {
  width: '24px',
  height: '24px',
  backgroundColor: '#059669',
  color: 'white',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  fontWeight: 'bold',
  fontSize: '12px',
};

const instructionText = {
  fontSize: '14px',
  color: '#334155',
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