import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '@/emails/BienvenidaEmpleado';
import { BienvenidaFlota } from '@/emails/BienvenidaFlota';
import { supabase } from '@/lib/supabaseClient';
import { generarTokenUnico } from '@/lib/telegram/generate-link';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { tipo, datos, to } = await request.json();

    if (!tipo || !datos || !to) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // =====================================================
    // GENERAR TOKEN DE TELEGRAM (si hay email)
    // =====================================================
    let telegramLink: string | undefined;
    let telegramToken: string | undefined;

    if (datos.email) {
      try {
        // Generar token según el tipo
        const tipoPrefijo = tipo === 'empleado' ? 'emp' : 'flt';
        const token = generarTokenUnico(tipoPrefijo, datos.id);
        telegramToken = token;
        
        // Construir link
        const botUsername = 'Notificaacceso_bot';
        telegramLink = `https://t.me/${botUsername}?start=${token}`;
        
        // Guardar token en la base de datos (expira en 7 días)
        const expiracion = new Date();
        expiracion.setDate(expiracion.getDate() + 7);
        
        if (tipo === 'empleado') {
          await supabase
            .from('empleados')
            .update({ 
              telegram_token: token,
              telegram_token_expira: expiracion.toISOString()
            })
            .eq('id', datos.id);
        } else {
          await supabase
            .from('flota_perfil')
            .update({ 
              telegram_token: token,
              telegram_token_expira: expiracion.toISOString()
            })
            .eq('id', datos.id);
        }
        
        console.log(`✅ Token Telegram generado para ${tipo}: ${token}`);
      } catch (error) {
        console.error('Error generando token Telegram:', error);
        // No falla el envío si no se puede generar el token
      }
    }

    // =====================================================
    // ENVIAR CORREO SEGÚN EL TIPO
    // =====================================================
    let emailContent;
    let subject;

    if (tipo === 'empleado') {
      emailContent = BienvenidaEmpleado({
        nombre: datos.nombre,
        documento_id: datos.documento_id,
        email: datos.email,
        rol: datos.rol,
        nivel_acceso: datos.nivel_acceso,
        pin_seguridad: datos.pin_seguridad,
        telegramLink,
        telegramToken,
      });
      subject = 'Bienvenido al Sistema - Credenciales de Acceso';
      
    } else if (tipo === 'flota') {
      emailContent = BienvenidaFlota({
        nombre_completo: datos.nombre_completo,
        documento_id: datos.documento_id,
        email: datos.email,
        nombre_flota: datos.nombre_flota,
        cant_choferes: datos.cant_choferes,
        cant_rutas: datos.cant_rutas,
        pin_secreto: datos.pin_secreto,
        telegramLink,
        telegramToken,
      });
      subject = 'Perfil de Flota Registrado - Credenciales de Acceso';
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo de correo no válido' },
        { status: 400 }
      );
    }

    // Enviar el correo
    const { data, error } = await resend.emails.send({
      from: 'Sistema de Gestión <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      react: emailContent,
    });

    if (error) {
      console.error('Error enviando correo:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Correo enviado correctamente',
      data,
      telegram: telegramLink ? { link: telegramLink, token: telegramToken } : undefined
    });

  } catch (error: any) {
    console.error('Error en send-email:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}