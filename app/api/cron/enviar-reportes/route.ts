import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Endpoint para ser llamado por servicios cron (cron-job.org)
 * Ejecuta la generación y envío de reportes programados
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[${requestId}] 🟢 Iniciando ejecución de reportes programados`);

  try {
    // 1. Verificar token de seguridad
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (expectedToken) {
      if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        console.warn(`[${requestId}] 🔴 Token inválido - Recibido: ${authHeader?.substring(0, 20)}`);
        return NextResponse.json(
          { 
            success: false, 
            error: 'No autorizado',
            requestId 
          }, 
          { status: 401 }
        );
      }
      console.log(`[${requestId}] 🟢 Token válido`);
    } else {
      console.warn(`[${requestId}] ⚠️ CRON_SECRET no configurado - autenticación deshabilitada`);
    }

    // 2. Aquí irá la lógica de generación de reportes
    // Por ahora, solo registramos la ejecución
    console.log(`[${requestId}] 📊 Procesando reportes programados...`);

    // Simular procesamiento (quitar en producción)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Respuesta exitosa
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] 🟢 Ejecución completada en ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Reportes procesados correctamente',
      timestamp: new Date().toISOString(),
      requestId,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] 🔴 Error en endpoint:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor',
        requestId,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}