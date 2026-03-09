import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[${requestId}] 🟢 Iniciando ejecución de reportes`);

  try {
    // ✅ AUTENTICACIÓN DESHABILITADA TEMPORALMENTE
    console.log(`[${requestId}] ⚠️ Autenticación deshabilitada - modo pruebas`);

    // Simular procesamiento
    await new Promise(resolve => setTimeout(resolve, 500));

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
    console.error(`[${requestId}] 🔴 Error:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno',
        requestId
      },
      { status: 500 }
    );
  }
}