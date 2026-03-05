// ============================================
// ARCHIVO DE PRUEBA: test-turnos.ts
// ============================================
// Este archivo solo existe para probar que los validadores funcionan
// Lo borraremos después de la verificación

import { safeValidateTurno } from './lib/turnos/validators';

console.log('🧪 INICIANDO PRUEBA DE VALIDADORES');
console.log('==================================');

// PRUEBA 1: Datos correctos (debería funcionar)
const prueba1 = {
  nombre: "Turno Mañana",
  hora_inicio: "08:00:00",
  hora_fin: "12:00:00",
  sucursal_codigo: "ALM01",
  dias_semana: [1, 2, 3, 4, 5], // Lunes a Viernes
  capacidad_min: 2,
  capacidad_max: 5
};

console.log('\n📋 PRUEBA 1: Datos correctos');
const resultado1 = safeValidateTurno(prueba1);
console.log('✅ ¿Válido?', resultado1.success);
if (resultado1.success) {
  console.log('📦 Datos validados:', resultado1.data);
} else {
  console.log('❌ Errores:', resultado1.error);
}

// PRUEBA 2: Hora fin menor que hora inicio (debería fallar)
const prueba2 = {
  ...prueba1,
  hora_inicio: "14:00:00",
  hora_fin: "12:00:00" // Esto está mal!
};

console.log('\n📋 PRUEBA 2: Hora fin menor que inicio (debe fallar)');
const resultado2 = safeValidateTurno(prueba2);
console.log('❌ ¿Falló como esperábamos?', resultado2.success === false);
if (!resultado2.success) {
  console.log('✅ Error capturado:', resultado2.error?.hora_fin);
}

// PRUEBA 3: Días duplicados (debería fallar)
const prueba3 = {
  ...prueba1,
  dias_semana: [1, 2, 2, 3] // Martes repetido
};

console.log('\n📋 PRUEBA 3: Días duplicados (debe fallar)');
const resultado3 = safeValidateTurno(prueba3);
console.log('❌ ¿Falló como esperábamos?', resultado3.success === false);
if (!resultado3.success) {
  console.log('✅ Error capturado:', resultado3.error?.dias_semana);
}

// PRUEBA 4: Nombre muy corto (debería fallar)
const prueba4 = {
  ...prueba1,
  nombre: "A" // Muy corto
};

console.log('\n📋 PRUEBA 4: Nombre muy corto (debe fallar)');
const resultado4 = safeValidateTurno(prueba4);
console.log('❌ ¿Falló como esperábamos?', resultado4.success === false);
if (!resultado4.success) {
  console.log('✅ Error capturado:', resultado4.error?.nombre);
}

console.log('\n==================================');
console.log('🏁 PRUEBA COMPLETADA');