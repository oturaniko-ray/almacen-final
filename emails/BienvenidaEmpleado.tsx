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
          <Section style={section}>
            <Text style={h1}>GESTOR DE ACCESO</Text>
            <Text style={h2}>Bienvenido al sistema</Text>

            <Text style={text}>Hola <strong>{nombre}</strong>,</Text>
            <Text style={text}>
              Se ha creado tu cuenta en el sistema. A continuación tus datos de acceso:
            </Text>

            <Section style={dataBox}>
              <Text style={dataItem}><strong>Documento:</strong> {documento_id}</Text>
              <Text style={dataItem}><strong>Email:</strong> {email}</Text>
              <Text style={dataItem}><strong>Rol:</strong> {rol}</Text>
              <Text style={dataItem}><strong>Nivel de acceso:</strong> {nivel_acceso}</Text>
            </Section>

            <Section style={pinBox}>
              <Text style={pinLabel}>🔐 PIN DE SEGURIDAD</Text>
              <Text style={pinValue}>{pin_seguridad}</Text>
              <Text style={pinWarning}>
                Este PIN es confidencial e intransmisible. No lo compartas con nadie.
              </Text>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Atentamente,
              <br />
              Administración del Sistema
            </Text>
            <Text style={copyright}>@Copyright 2026</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BienvenidaEmpleado;

// Estilos (obligatorio escribirlos así en React Email)
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const section = {
  padding: '0 48px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const h2 = {
  color: '#2563eb',
  fontSize: '20px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '20px 0',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
};

const dataBox = {
  backgroundColor: '#f3f4f6',
  padding: '24px',
  borderRadius: '8px',
  margin: '24px 0',
};

const dataItem = {
  ...text,
  margin: '8px 0',
};

const pinBox = {
  backgroundColor: '#1a1a1a',
  padding: '24px',
  borderRadius: '8px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const pinLabel = {
  color: '#9ca3af',
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  margin: '0 0 12px',
};

const pinValue = {
  color: '#f59e0b',
  fontSize: '32px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  margin: '0 0 12px',
};

const pinWarning = {
  color: '#9ca3af',
  fontSize: '12px',
  fontStyle: 'italic',
  margin: '0',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
};

const copyright = {
  ...footer,
  marginTop: '8px',
  fontSize: '10px',
  color: '#666',
};