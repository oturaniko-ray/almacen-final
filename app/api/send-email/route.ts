import { NextResponse } from 'next/server';
import { enviarEmail } from '@/emails/emailService';

export async function POST(request: Request) {
  // Verificar método
  if (request.method !== 'POST') {
    return NextResponse.json(
      { success: false, error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    const { tipo, datos, to } = body;

    // Validar datos mínimos
    if (!tipo || !datos) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Usar el destinatario proporcionado o el email de los datos
    const destinatario = to || datos.email;
    if (!destinatario) {
      return NextResponse.json(
        { success: false, error: 'No se especificó destinatario' },
        { status: 400 }
      );
    }

    const resultado = await enviarEmail(tipo, datos, destinatario);
    
    if (resultado.success) {
      return NextResponse.json(resultado);
    } else {
      return NextResponse.json(
        { success: false, error: resultado.error },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error en API send-email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}