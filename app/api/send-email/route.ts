import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '@/emails/BienvenidaEmpleado';
import { BienvenidaFlota } from '@/emails/BienvenidaFlota';
import { supabase } from '@/lib/supabaseClient';
import { generarTokenUnico } from '@/lib/telegram/generate-link';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { tipo, datos, to } = await request.json();

    // LOG 1: Verificar qué datos llegan
    console.log('🔍 [DEBUG] Datos recibidos:', { tipo, datos, to });

    if (!tipo || !datos || !to) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // =====================================================
    // GENERAR TOKEN DE TELEGRAM
    // =====================================================
    let telegramLink: string | undefined;
    let telegramToken: string | undefined;

    // LOG 2: Verificar si hay email
    console.log('🔍 [DEBUG] Email disponible:', datos.email ? 'SÍ' : 'NO');

    if (datos.email) {
      try {
        const tipoPrefijo = tipo === 'empleado' ? 'emp' : 'flt';
        console.log('🔍 [DEBUG] Tipo prefijo:', tipoPrefijo);
        
        const token = generarTokenUnico(tipoPrefijo, datos.id);
        console.log('🔍 [DEBUG] Token generado:', token);
        
        telegramToken = token;
        
        const botUsername = 'Notificaacceso_bot';
        telegramLink = `https://t.me/${botUsername}?start=${token}`;
        
        const expiracion = new Date();
        expiracion.setDate(expiracion.getDate() + 7);
        
        console.log(`📝 Intentando guardar token para ${tipo} ID: ${datos.id}`);
        
        if (tipo === 'empleado') {
          const { error, data } = await supabase
            .from('empleados')
            .update({
              telegram_token: token,
              telegram_token_expira: expiracion.toISOString()
            } as never)
            .eq('id', datos.id)
            .select();
          
          if (error) {
            console.error('❌ Error guardando token en empleados:', error);
          } else {
            console.log(`✅ Token guardado en empleados:`, data);
          }
        } else {
          // LOG 3: Verificar antes de guardar en flota
          console.log('🔍 [FLOTA] Intentando guardar en flota_perfil con ID:', datos.id);
          
          const { error, data } = await supabase
            .from('flota_perfil')
            .update({
              telegram_token: token,
              telegram_token_expira: expiracion.toISOString()
            } as never)
            .eq('id', datos.id)
            .select();
          
          if (error) {
            console.error('❌ Error guardando token en flota:', error);
          } else {
            console.log(`✅ Token guardado en flota:`, data);
          }
        }
      } catch (error) {
        console.error('❌ Error en bloque de generación de token:', error);
      }
    } else {
      console.log('⚠️ No se generó token: email no disponible');
    }

    // LOG 4: Verificar qué se va a pasar a la plantilla
    console.log('🔍 [DEBUG] telegramLink:', telegramLink);
    console.log('🔍 [DEBUG] telegramToken:', telegramToken);

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