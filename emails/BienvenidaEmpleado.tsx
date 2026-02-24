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

interface BienvenidaEmpleadoProps {
  nombre: string;
  documento_id: string;
  email: string;
  rol: string;
  nivel_acceso: number;
  pin_seguridad: string;
  telegramLink?: string;
  telegramToken?: string;
}

export const BienvenidaEmpleado = ({
  nombre,
  documento_id,
  email,
  rol,
  nivel_acceso,
  pin_seguridad,
  telegramLink,
  telegramToken,
}: BienvenidaEmpleadoProps) => {
  const previewText = `Bienvenido al sistema, ${nombre}`;
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
            <Text style={headerTitle}>GESTOR DE ACCESO</Text>
            <Text style={headerSubtitle}>Sistema de Control de Personal</Text>
          </Section>

          {/* Mensaje de bienvenida */}
          <Section style={welcomeSection}>
            <Text style={welcomeText}>
              🎉 ¡Bienvenido a bordo, <strong>{nombre}</strong>!
            </Text>
            <Text style={welcomeDescription}>
              Tu cuenta ha sido creada exitosamente en nuestro sistema. A continuación encontrarás tus credenciales de acceso.
            </Text>
          </Section>

          {/* ===================================================== */}
          {/* SECCIÓN: Telegram - Canal de comunicación */}
          {/* ===================================================== */}
          <Section style={telegramSection}>
            <Text style={telegramTitle}>📱 CANAL DE COMUNICACIÓN OFICIAL</Text>
            <Text style={telegramText}>
              Utilizamos <strong>Telegram</strong> para enviarte notificaciones importantes y confirmar la recepción de este correo.
            </Text>

            {telegramLink ? (
              <>
                <Text style={telegramText}>
                  Haz clic en el siguiente enlace para vincular tu cuenta de Telegram:
                </Text>
                <a href={telegramLink} style={telegramButton}>
                  🔗 VINCULAR CON TELEGRAM
                </a>
                {telegramToken && (
                  <Text style={telegramTokenStyle}>
                    Token: <strong>{telegramToken}</strong>
                  </Text>
                )}
                <Text style={telegramHint}>
                  * Una vez vinculado, recibirás tus credenciales automáticamente.
                </Text>
              </>
            ) : (
              <>
                <Text style={telegramText}>
                  Para recibir notificaciones por Telegram, descarga la aplicación desde el siguiente enlace:
                </Text>
                <a href={telegramDownloadUrl} style={telegramDownloadButton}>
                  📲 DESCARGAR TELEGRAM
                </a>
                <Text style={telegramHint}>
                  Después de instalar, busca <strong>@Notificaacceso_bot</strong> y presiona INICIAR.
                </Text>
              </>
            )}

            {/* Botón de confirmación de inicio (solo si hay link) */}
            {telegramLink && (
              <div style={startButtonContainer}>
                <Text style={startButtonText}>¿Ya tienes Telegram y quieres confirmar la recepción?</Text>
                <a href={`https://t.me/Notificaacceso_bot?start=confirmar_${telegramToken || 'recepcion'}`} style={startButton}>
                  ✅ CONFIRMAR RECEPCIÓN
                </a>
                <Text style={startButtonHint}>
                  Al presionar "INICIAR" en el bot, confirmarás que has recibido esta información.
                </Text>
              </div>
            )}
          </Section>

          {/* Link de acceso destacado */}
          <Section style={linkSection}>
            <Text style={linkLabel}>📍 ACCEDE DESDE AQUÍ</Text>
            <a href={appUrl} style={linkButton}>
              {appUrl}
            </a>
            <Text style={linkHint}>
              Haz clic en el enlace o cópialo en tu navegador
            </Text>
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

          <Hr style={hr} />

          {/* Pie de página */}
          <Section style={footer}>
            <Text style={footerText}>
              Este es un mensaje automático del Sistema de Gestión de Acceso. Por favor, no respondas a este correo.
            </Text>
            <Text style={footerText}>
              © 2026 Gestor de Acceso. Todos los derechos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BienvenidaEmpleado;

// =====================================================
// ESTILOS (AÑADIDOS LOS NUEVOS PARA TELEGRAM)
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
  color: '#1e293b',
  margin: '0 0 4px',
};

const headerSubtitle = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0',
};

const welcomeSection = {
  backgroundColor: '#e6f0ff',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px',
  border: '1px solid #b8d4ff',
};

const welcomeText = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1e3a8a',
  margin: '0 0 8px',
};

const welcomeDescription = {
  fontSize: '14px',
  color: '#334155',
  margin: '0',
};

// Estilos de Telegram
const telegramSection = {
  backgroundColor: '#e8f5fe',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px',
  border: '2px solid #0088cc',
};

const telegramTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0088cc',
  margin: '0 0 12px',
  textAlign: 'center' as const,
};

const telegramText = {
  fontSize: '14px',
  color: '#334155',
  margin: '0 0 16px',
  textAlign: 'left' as const,
};

const telegramButton = {
  display: 'inline-block',
  backgroundColor: '#0088cc',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '30px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  margin: '8px 0',
  boxShadow: '0 4px 6px rgba(0, 136, 204, 0.3)',
  textAlign: 'center' as const,
};

const telegramDownloadButton = {
  display: 'inline-block',
  backgroundColor: '#2AABEE',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '30px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  margin: '8px 0',
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
  margin: '8px 0',
  fontFamily: 'monospace',
  border: '1px solid #0088cc',
};

const telegramHint = {
  fontSize: '11px',
  color: '#6b7280',
  fontStyle: 'italic' as const,
  margin: '12px 0 0',
};

const startButtonContainer = {
  marginTop: '20px',
  padding: '16px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #0088cc',
};

const startButtonText = {
  fontSize: '14px',
  color: '#334155',
  margin: '0 0 12px',
  textAlign: 'center' as const,
  fontWeight: 'bold',
};

const startButton = {
  display: 'inline-block',
  backgroundColor: '#00b300',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '30px',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  margin: '8px 0',
  boxShadow: '0 4px 6px rgba(0, 179, 0, 0.3)',
  textAlign: 'center' as const,
};

const startButtonHint = {
  fontSize: '11px',
  color: '#6b7280',
  fontStyle: 'italic' as const,
  margin: '8px 0 0',
  textAlign: 'center' as const,
};

const linkSection = {
  backgroundColor: '#f0f9ff',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px',
  textAlign: 'center' as const,
  border: '1px solid #7ab3ff',
  boxShadow: '0 4px 8px rgba(0, 102, 255, 0.1)',
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