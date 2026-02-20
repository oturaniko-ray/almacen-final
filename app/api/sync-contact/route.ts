import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';

// Al inicio de la función POST, agrega:
console.log('🔍 Token presente:', !!RESPONDIO_API_TOKEN);
console.log('🔍 Token (primeros 10 chars):', RESPONDIO_API_TOKEN?.substring(0, 10));

export async function POST(request: Request) {
  try {
    const { to, nombre, email, documento_id, empleado_id } = await request.json();
    
    if (!to || !nombre) {
      return NextResponse.json(
        { success: false, error: 'Teléfono y nombre requeridos' },
        { status: 400 }
      );
    }

    if (!RESPONDIO_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Token no configurado' },
        { status: 500 }
      );
    }

    const telefonoLimpio = to.replace(/\s+/g, '');
    const identifier = `phone:${telefonoLimpio}`;
    
    const nameParts = nombre.split(' ');
    const firstName = nameParts[0] || 'Empleado';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contactPayload = {
      firstName: firstName,
      lastName: lastName,
      phone: telefonoLimpio,
      email: email || `${firstName}.${lastName}@ejemplo.com`,
      language: 'es',
      custom_fields: documento_id ? [{
        name: 'documento_id',
        value: documento_id
      }] : []
    };

    console.log('📤 Sincronizando contacto:', { identifier, payload: contactPayload });

    const url = `${BASE_URL}/contact/${identifier}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPONDIO_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    const responseText = await response.text();
    console.log('📥 Respuesta:', response.status, responseText);

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Error ${response.status}: ${responseText}`,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    
    if (empleado_id) {
      // ✅ SOLUCIÓN: usar 'as never' para el objeto de update
      await (supabase
        .from('empleados')
        .update({
          respondio_contact_id: data.id,
          respondio_sincronizado: true,
          respondio_ultima_sincronizacion: new Date().toISOString()
        } as never)
        .eq('id', empleado_id));
    }

    return NextResponse.json({
      success: true,
      message: 'Contacto sincronizado correctamente',
      respondio_contact_id: data.id,
      data: data
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}