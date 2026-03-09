import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { generarTimesheetExcel, generarComparativaExcel } from '@/lib/reportes/generadores';
import { enviarReportePorEmail } from '@/lib/email/reportes';
import { format } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos máximo

export async function GET(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] ========== INICIANDO REPORTES ==========`);

  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.log(`[${requestId}] 🔴 No autorizado`);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log(`[${requestId}] 🟢 Autenticación OK`);

    const supabase = await createServerSupabaseClient();
    
    // 2. Obtener reportes programados ACTIVOS
    const hoy = new Date();
    const hoyStr = format(hoy, 'yyyy-MM-dd');
    
    const { data: reportes, error } = await supabase
      .from('reportes_programados')
      .select('*')
      .eq('activo', true);

    if (error) throw error;

    console.log(`[${requestId}] 📊 Reportes activos: ${reportes?.length || 0}`);

    if (!reportes || reportes.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay reportes programados',
        requestId 
      });
    }

    // Filtrar reportes que deben ejecutarse hoy
    const reportesHoy = reportes.filter(reporte => {
      if (!reporte.proximo_envio) return false;
      return reporte.proximo_envio.split('T')[0] <= hoyStr;
    });

    console.log(`[${requestId}] 📅 Reportes para hoy: ${reportesHoy.length}`);

    const resultados = [];

    // 3. Procesar cada reporte
    for (const reporte of reportesHoy) {
      try {
        console.log(`[${requestId}] 🔄 Procesando: ${reporte.nombre}`);

        // Calcular período según frecuencia
        const fechaInicio = calcularFechaInicio(reporte.frecuencia);
        const fechaFin = format(new Date(), 'yyyy-MM-dd');

        console.log(`[${requestId}] 📆 Período: ${fechaInicio} al ${fechaFin}`);

        // Generar reporte según tipo
        let buffer: Buffer;
        let filename: string;

        switch (reporte.tipo) {
          case 'timesheet':
            buffer = await generarTimesheetExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
            filename = `timesheet_${fechaInicio}_${fechaFin}.xlsx`;
            break;
          case 'comparativa':
            buffer = await generarComparativaExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
            filename = `comparativa_${fechaInicio}_${fechaFin}.xlsx`;
            break;
          default:
            throw new Error(`Tipo no soportado: ${reporte.tipo}`);
        }

        // Enviar por email
        await enviarReportePorEmail(
          reporte.destinatarios,
          `📊 ${reporte.nombre} - ${fechaInicio} al ${fechaFin}`,
          buffer,
          filename
        );

        // Guardar en historial
        await supabase
          .from('reportes_historial')
          .insert({
            reporte_programado_id: reporte.id,
            fecha_generacion: new Date().toISOString(),
            archivo_url: filename,
            tamaño_bytes: buffer.length,
            destinatarios: reporte.destinatarios,
            enviado: true
          });

        // Actualizar próximo envío
        const proximoEnvio = calcularProximoEnvio(reporte);
        await supabase
          .from('reportes_programados')
          .update({
            ultimo_envio: new Date().toISOString(),
            proximo_envio: proximoEnvio
          })
          .eq('id', reporte.id);

        console.log(`[${requestId}] ✅ Reporte completado: ${reporte.nombre}`);
        resultados.push({ id: reporte.id, nombre: reporte.nombre, status: 'ok' });

      } catch (error) {
        console.error(`[${requestId}] ❌ Error en reporte ${reporte.nombre}:`, error);

        await supabase
          .from('reportes_historial')
          .insert({
            reporte_programado_id: reporte.id,
            fecha_generacion: new Date().toISOString(),
            enviado: false,
            destinatarios: reporte.destinatarios,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });

        resultados.push({ 
          id: reporte.id, 
          nombre: reporte.nombre, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Error desconocido' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Procesados ${resultados.length} reportes`,
      timestamp: new Date().toISOString(),
      resultados,
      requestId
    });

  } catch (error) {
    console.error(`[${requestId}] 🔴 Error general:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido',
        requestId 
      },
      { status: 500 }
    );
  } finally {
    console.log(`[${requestId}] ========== FIN EJECUCIÓN ==========`);
  }
}

// Funciones auxiliares
function calcularFechaInicio(frecuencia: string): string {
  const hoy = new Date();
  
  switch (frecuencia) {
    case 'diario':
      return format(hoy, 'yyyy-MM-dd');
    case 'semanal':
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
      return format(inicioSemana, 'yyyy-MM-dd');
    case 'mensual':
      return format(new Date(hoy.getFullYear(), hoy.getMonth(), 1), 'yyyy-MM-dd');
    case 'trimestral':
      const trimestre = Math.floor(hoy.getMonth() / 3) * 3;
      return format(new Date(hoy.getFullYear(), trimestre, 1), 'yyyy-MM-dd');
    default:
      return format(hoy, 'yyyy-MM-dd');
  }
}

function calcularProximoEnvio(reporte: any): string {
  const fecha = new Date(reporte.proximo_envio || new Date());
  
  switch (reporte.frecuencia) {
    case 'diario':
      fecha.setDate(fecha.getDate() + 1);
      break;
    case 'semanal':
      fecha.setDate(fecha.getDate() + 7);
      break;
    case 'mensual':
      fecha.setMonth(fecha.getMonth() + 1);
      break;
    case 'trimestral':
      fecha.setMonth(fecha.getMonth() + 3);
      break;
  }
  
  return format(fecha, 'yyyy-MM-dd') + 'T' + (reporte.hora_envio || '08:00:00');
}