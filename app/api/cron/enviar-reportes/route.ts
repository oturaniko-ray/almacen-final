import { NextResponse } from 'next/server';
import { reporteScheduler } from '@/lib/reportes/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Endpoint para ser llamado por un servicio cron
export async function GET(request: Request) {
  try {
    // Verificar token de seguridad
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    // ✅ CORREGIDO: Template literal con backticks
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'No autorizado' }, 
        { status: 401 }
      );
    }

    // Inicializar el scheduler (si es necesario)
    // const scheduler = new ReporteScheduler();
    
    // Por ahora, solo respondemos que está funcionando
    return NextResponse.json({
      success: true,
      message: 'Endpoint de reportes funcionando correctamente',
      timestamp: new Date().toISOString()
    });

    // Cuando tengas la lógica implementada:
    // await reporteScheduler.actualizarProximosEnvios();
    // await reporteScheduler.ejecutarEnviosPendientes();

  } catch (error) {
    console.error('Error en endpoint de reportes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}