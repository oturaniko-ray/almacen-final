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

          {/* ===================================================== */}
          {/* SECCIÓN: Telegram - Canal de comunicación */}
          {/* ===================================================== */}
          <Section style={telegramSection}>
            <Text style={telegramTitle}>📱 CANAL DE COMUNICACIÓN OFICIAL</Text>
            <Text style={telegramText}>
              Nuestro canal de comunicación es <strong>Telegram</strong>. 
              {telegramLink ? (
                <> Para vincular tu cuenta de flota, haz clic en el siguiente enlace:</>
              ) : (
                " Para comenzar, descarga la aplicación desde el siguiente enlace:"
              )}
            </Text>
            
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
            
            <Text style={telegramHint}>
              * Una vez vinculado, recibirás notificaciones sobre tu flota.
            </Text>

            {/* Botón de confirmación de inicio */}
            {telegramLink && (
              <div style={startButtonContainer}>
                <Text style={startButtonText}>¿Ya tienes Telegram y quieres confirmar la recepción?</Text>
                <a href={`https://t.me/Notificaacceso_bot?start=confirmar_${telegramToken || 'recepcion'}`} style={startButton}>
                  ✅ CONFIRMAR RECEPCIÓN DEL CORREO
                </a>
                <Text style={startButtonHint}>
                  Al hacer clic en "INICIO" en el bot, confirmarás que has recibido esta información.
                </Text>
              </div>
            )}

            {/* Enlace de descarga alternativo */}
            {!telegramLink && (
              <Text style={telegramHint}>
                Después de instalar Telegram, busca <strong>@Notificaacceso_bot</strong> y presiona INICIAR.
              </Text>
            )}
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

// =====================================================
// ESTILOS COMPLETOS (Mismos que en BienvenidaEmpleado)
// =====================================================
// (Los mismos estilos definidos arriba, copiados aquí)