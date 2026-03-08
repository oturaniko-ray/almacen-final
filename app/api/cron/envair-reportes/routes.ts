import { NextResponse } from 'next/server';
import { reporteScheduler } from '@/lib/reportes/scheduler';

// Endpoint para ser llamado por un servicio cron
// Ejemplo: https://cron-job.org llamando cada 5 minutos
export async function GET(request: Request) {
  // Verificar token de seguridad (opcional pero recomendado)
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  
  try {
    // Actualizar próximos envíos
    await reporteScheduler.actualizarProximosEnvios();
    
    // Ejecutar envíos pendientes
    await reporteScheduler.ejecutarEnviosPendientes();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Reportes procesados correctamente' 
    });
    
  } catch (error) {
    console.error('Error en cron de reportes:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 });
  }
}