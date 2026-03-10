'use client';

export default function DashboardUI() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFB5B5] via-[#E8F4F8] via-[#B8E4F0] to-[#A8D5C5] p-8 font-['Inter'] relative overflow-hidden">
      
      {/* Orbes de luz difusa */}
      <div className="absolute top-20 left-[10%] w-[400px] h-[400px] rounded-full bg-[#FFB5B5]/30 blur-[80px] -z-10"></div>
      <div className="absolute bottom-20 right-[5%] w-[500px] h-[500px] rounded-full bg-[#A8D5C5]/30 blur-[100px] -z-10"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#B8E4F0]/20 blur-[120px] -z-10"></div>

      {/* Contenedor principal estilo vidrio */}
      <div className="max-w-7xl mx-auto bg-white/65 backdrop-blur-xl border border-white/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-6 relative z-10">
        
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-[#FF8A8A] via-[#FFA8A8] via-[#A8D5FF] to-[#8AB8FF] h-16 -mt-6 -mx-6 mb-6 rounded-t-2xl px-8 flex items-center justify-between">
          <h1 className="text-[#1F2937] text-xl font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)]">
            Panel Administrativo
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/30 rounded-full border border-white/50 flex items-center justify-center">
              <span className="text-[#1F2937]">👤</span>
            </div>
          </div>
        </div>

        {/* Layout de 2 columnas */}
        <div className="flex gap-6">
          
          {/* Sidebar */}
          <div className="w-[220px] flex-shrink-0 flex flex-col gap-3">
            <div className="bg-white/70 border border-white/60 rounded-lg p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
              <h3 className="text-[#374151] text-xs font-semibold mb-1">Dashboard</h3>
              <p className="text-[#6B7280] text-[11px]">Vista general</p>
            </div>
            <div className="bg-gradient-to-br from-[#A8D5C5]/40 to-[#A8D5C5]/20 border border-[#A8D5C5]/50 rounded-lg p-4">
              <h3 className="text-[#374151] text-xs font-semibold mb-1">Gestión Horarios</h3>
              <p className="text-[#6B7280] text-[11px]">Turnos y programación</p>
            </div>
            <div className="bg-gradient-to-br from-[#FFF5DC]/50 to-[#FFF5DC]/30 border border-[#FFDCB4]/40 rounded-lg p-4">
              <h3 className="text-[#374151] text-xs font-semibold mb-1">RRHH Operativo</h3>
              <p className="text-[#6B7280] text-[11px]">Personal y ausencias</p>
            </div>
            <div className="bg-white/70 border border-white/60 rounded-lg p-4">
              <h3 className="text-[#374151] text-xs font-semibold mb-1">Auditoría Flota</h3>
              <p className="text-[#6B7280] text-[11px]">Control de vehículos</p>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="flex-1 space-y-6">
            
            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Turnos Hoy', value: '24', color: 'from-[#FF8A8A] to-[#FFA8A8]' },
                { label: 'Empleados', value: '136', color: 'from-[#A8D5C5] to-[#B8E4D5]' },
                { label: 'Ausencias', value: '8', color: 'from-[#8AB8FF] to-[#A8C8FF]' },
                { label: 'Eficiencia', value: '92%', color: 'from-[#FFB5B5] to-[#FFD5D5]' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white/70 border border-white/60 rounded-lg p-4">
                  <p className="text-[#6B7280] text-xs mb-2">{kpi.label}</p>
                  <div className="flex items-end justify-between">
                    <span className="text-[#1F2937] text-2xl font-semibold font-['JetBrains_Mono']">{kpi.value}</span>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${kpi.color}`}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calendario de turnos */}
            <div className="bg-white/70 border border-white/60 rounded-lg p-6">
              <h2 className="text-[#374151] text-sm font-semibold mb-4 flex items-center gap-2">
                <span>📅</span> Programación Semanal
              </h2>
              
              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-2 mb-2 pb-3 border-b border-black/10">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                  <div key={dia} className="text-[#6B7280] text-xs font-semibold text-center uppercase tracking-wider">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Celdas del calendario */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square min-h-[80px] bg-white/50 border border-black/5 rounded-lg p-2 relative hover:bg-white/80 transition-all">
                    <span className="text-[#374151] text-sm font-medium absolute top-2 right-2">
                      {i + 1}
                    </span>
                    
                    {/* Badge flotante de ejemplo */}
                    {i === 15 && (
                      <div className="absolute bottom-2 left-2 bg-gradient-to-br from-[#FFB5A1]/90 to-[#FFC8B4]/85 border border-[#FFB5A1]/60 rounded-full px-3 py-1 text-xs shadow-[0_4px_12px_rgba(255,181,161,0.3)] flex items-center gap-1 animate-pulse">
                        <span className="text-[#1F2937] text-[10px] font-semibold">Juan P.</span>
                        <span className="text-[#4B5563] text-[9px]">Mañana</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de ejemplo */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* Gráfico de barras */}
              <div className="bg-white/70 border border-white/60 rounded-lg p-6">
                <h3 className="text-[#374151] text-sm font-semibold mb-4">Horas por día</h3>
                <div className="h-40 flex items-end justify-between gap-3">
                  {[65, 80, 45, 90, 70, 55, 85].map((height, i) => (
                    <div key={i} className="w-8 group relative">
                      <div 
                        className={`w-full bg-gradient-to-t ${
                          i % 3 === 0 ? 'from-[#FF8A8A] to-[#FFA8A8]' :
                          i % 3 === 1 ? 'from-[#A8D5C5] to-[#B8E4D5]' :
                          'from-[#8AB8FF] to-[#A8C8FF]'
                        } rounded-t-md transition-all hover:scale-y-105 hover:brightness-110`}
                        style={{ height: `${height}px` }}
                      ></div>
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-[#9CA3AF] font-mono">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slider de progreso */}
              <div className="bg-white/70 border border-white/60 rounded-lg p-6">
                <h3 className="text-[#374151] text-sm font-semibold mb-4">Cumplimiento semanal</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Turnos cubiertos', value: 75 },
                    { label: 'Asistencia', value: 92 },
                    { label: 'Puntualidad', value: 68 },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#6B7280]">{item.label}</span>
                        <span className="text-[#1F2937] font-medium font-mono">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#FF8A8A] via-[#A8D5C5] to-[#8AB8FF] rounded-full relative"
                          style={{ width: `${item.value}%` }}
                        >
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-3 border-[#A8D5C5] rounded-full shadow-lg"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}