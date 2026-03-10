// app/api/cron/enviar-reportes/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { generarTimesheetExcel, generarComparativaExcel } from '@/lib/reportes/generadores';
import { enviarReportePorEmail } from '@/lib/email/reportes';
import { format } from 'date-fns';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaInicio = format(ayer, 'yyyy-MM-dd');
    const fechaFin = format(ayer, 'yyyy-MM-dd');

    console.log(`📆 Ejecutando cron para fecha: ${fechaInicio}`);

    const timesheetBuffer = await generarTimesheetExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
    const comparativaBuffer = await generarComparativaExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });

    const { data: usuarios } = await supabase
      .from('empleados')
      .select('email, nombre')
      .eq('permiso_reportes', true)
      .eq('activo', true);

    if (!usuarios || usuarios.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay destinatarios para reportes' });
    }

    const destinatarios = usuarios.map(u => u.email).filter(Boolean);

    const attachments = [
      {
        filename: `timesheet_${fechaInicio}.xlsx`,
        content: timesheetBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      {
        filename: `comparativa_${fechaInicio}.xlsx`,
        content: comparativaBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ];

    const resultado = await enviarReportePorEmail(
      destinatarios,
      `Reportes del ${fechaInicio}`,
      `
        <h2>Reportes del ${fechaInicio}</h2>
        <p>Adjunto encontrarás los reportes generados automáticamente.</p>
        <ul>
          <li>Timesheet - Registro de jornadas</li>
          <li>Comparativa - Asignaciones vs jornadas</li>
        </ul>
        <p><small>Este es un correo automático del sistema de gestión.</small></p>
      `,
      attachments
    );

    if (resultado && resultado.accepted && resultado.accepted.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Reportes enviados',
        accepted: resultado.accepted,
        rejected: resultado.rejected || []
      });
    } else {
      throw new Error('No se pudo enviar el correo');
    }

  } catch (error) {
    console.error('❌ Error en cron de reportes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}