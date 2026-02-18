import { NextResponse } from 'next/server';
import { enviarEmail } from '@/emails/emailService';

export async function GET() {
  const resultado = await enviarEmail('test', { 
    email: 'oturaniko@gmail.com' // PON TU CORREO AQUÍ
  }, 'oturaniko@gmail.com');
  
  return NextResponse.json(resultado);
}