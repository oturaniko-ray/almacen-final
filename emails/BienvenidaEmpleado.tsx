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
import { generarTokenUnico } from '@/lib/telegram/generate-link';
import { createClient } from '@supabase/supabase-js';

interface BienvenidaEmpleadoProps {
  nombre: string;
  documento_id: string;
  email: string;
  rol: string;
  nivel_acceso: number;
  pin_seguridad: string;
  empleadoId: string;
  telegramBotUsername?: string;
}

export const BienvenidaEmpleado = async ({
  nombre,
  documento_id,
  email,
  rol,
  nivel_acceso,
  pin_seguridad,
  empleadoId,
  telegramBotUsername = 'Notificaacceso_bot',
}: BienvenidaEmpleadoProps) => {
  const previewText = `Bienvenido al sistema, ${nombre}`;
  const appUrl = 'https://almacen-final-git-main-rayperez-projects.vercel.app/';
  const telegramDownloadUrl = 'https://telegram.org/apps';
  
  // ===== NUEVA LÓGICA CON TOKEN EN EMPLEADOS =====
  let token = '';
  let telegramBotLink = '';
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // ✅ PASO 1: Buscar token en la tabla empleados
    // Buscar token en la tabla empleados
const { data: empleado } = await supabase
  .from('empleados')
  .select('telegram_token')
  .eq('id', empleadoId)
  .maybeSingle();

if (empleado?.telegram_token) {
  token = empleado.telegram_token;
  console.log(`📱 Reutilizando token existente para empleado ${nombre}`);
} else {
  token = generarTokenUnico('emp', documento_id);
  console.log('🔵 [EMAIL] Token generado:', token);

  // Actualizar empleados
  const { error: updateError } = await supabase
    .from('empleados')
    .update({ telegram_token: token, updated_at: new Date().toISOString() })
    .eq('id', empleadoId);

  if (updateError) {
    console.error('🔴 [EMAIL] Error al actualizar empleados:', updateError);
  } else {
    console.log('🟢 [EMAIL] Token guardado en empleados OK');
  }

  // Upsert en telegram_usuarios
  const { error: upsertError } = await supabase
    .from('telegram_usuarios')
    .upsert({
      empleado_id: empleadoId,
      token_unico: token,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'empleado_id' });

  if (upsertError) {
    console.error('🔴 [EMAIL] Error al hacer upsert en telegram_usuarios:', upsertError);
  } else {
    console.log('🟢 [EMAIL] Token guardado en telegram_usuarios OK');
  }
}
  // ===== FIN LÓGICA =====
  
  // Construir el link de Telegram con el token
  telegramBotLink = `https://t.me/${telegramBotUsername}?start=${token}`;
} catch (error) {
  console.error('🔴 [EMAIL] Error en lógica de Telegram:', error);
  telegramBotLink = `https://t.me/${telegramBotUsername}`;
}

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

          {/* DATOS DEL EMPLEADO */}
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

          {/* ACCESO AL SISTEMA */}
          <Section style={accessSection}>
            <Text style={accessTitle}>🚀 ACCEDER AL SISTEMA</Text>
            <a href={appUrl} style={accessButton}>
              INGRESAR AL SISTEMA
            </a>
            <Text style={accessHint}>
              Haz clic en el botón para acceder con tu Documento/Email y el PIN de seguridad.
            </Text>
          </Section>

          {/* SECCIÓN TELEGRAM */}
          <Section style={telegramSection}>
            <Text style={telegramTitle}>📱 CONFIRMACIÓN POR TELEGRAM</Text>
            
            <div style={telegramMainContainer}>
              <Text style={telegramMainText}>
                Para recibir notificaciones y confirmar la recepción de este correo:
              </Text>
              <a href={telegramBotLink} style={telegramMainButton}>
                🤖 INGRESAR A TELEGRAM PARA CONFIRMAR
              </a>
              <Text style={telegramBotName}>
                @{telegramBotUsername}
              </Text>
            </div>

            <div style={telegramDownloadContainer}>
              <Text style={telegramDownloadText}>
                ¿No tienes Telegram?
              </Text>
              <a href={telegramDownloadUrl} style={telegramDownloadButton}>
                📲 DESCARGAR TELEGRAM
              </a>
            </div>

            <Text style={telegramHint}>
              * Una vez que inicies conversación con el bot, tu cuenta quedará vinculada automáticamente para futuras notificaciones.
            </Text>
          </Section>

          {/* Instrucciones de acceso */}
          <Section style={instructionsSection}>
            <Text style={instructionsTitle}>📱 CÓMO ACCEDER AL SISTEMA</Text>
            <div style={instructionsBox}>
              <div style={instructionItem}>
                <span style={instructionNumber}>1</span>
                <span style={instructionText}>Haz clic en <strong>"INGRESAR AL SISTEMA"</strong></span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>2</span>
                <span style={instructionText}>Selecciona <strong>"ACCESO PERSONAL"</strong></span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>3</span>
                <span style={instructionText}>Ingresa tu <strong>Documento</strong> o <strong>Correo</strong></span>
              </div>
              <div style={instructionItem}>
                <span style={instructionNumber}>4</span>
                <span style={instructionText}>Usa el <strong>PIN</strong> proporcionado arriba</span>
              </div>
            </div>
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

// =====================================================
// ESTILOS (IGUALES)
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
  marginBottom: '24px',
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

const accessSection = {
  backgroundColor: '#e6f0ff',
  padding: '20px',
  borderRadius: '12px',
  marginBottom: '24px',
  textAlign: 'center' as const,
  border: '2px solid #2563eb',
};

const accessTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1e3a8a',
  margin: '0 0 16px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

const accessButton = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '16px 32px',
  borderRadius: '50px',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  marginBottom: '12px',
  boxShadow: '0 8px 16px rgba(37, 99, 235, 0.4)',
};

const accessHint = {
  fontSize: '13px',
  color: '#4b5563',
  margin: '0',
};

const telegramSection = {
  marginBottom: '24px',
  padding: '16px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #0088cc',
};

const telegramTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const telegramMainContainer = {
  backgroundColor: '#e6f7ff',
  padding: '16px',
  borderRadius: '8px',
  marginBottom: '12px',
  border: '1px solid #0088cc',
};

const telegramMainText = {
  fontSize: '14px',
  color: '#334155',
  margin: '0 0 12px',
  textAlign: 'center' as const,
};

const telegramMainButton = {
  display: 'block',
  backgroundColor: '#0088cc',
  color: '#ffffff',
  padding: '14px',
  borderRadius: '30px',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  marginBottom: '8px',
  boxShadow: '0 4px 8px rgba(0, 136, 204, 0.4)',
};

const telegramBotName = {
  fontSize: '13px',
  color: '#0088cc',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '4px 0 0',
};

const telegramDownloadContainer = {
  padding: '12px',
  textAlign: 'center' as const,
};

const telegramDownloadText = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 8px',
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
};

const telegramHint = {
  fontSize: '11px',
  color: '#6b7280',
  fontStyle: 'italic' as const,
  margin: '12px 0 0',
  textAlign: 'center' as const,
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
  backgroundColor: '#2563eb',
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

