// 1. prisma/schema.prisma
// Agrega o actualiza estos modelos basados en tu SQL actual

model Employee {
  id               String        @id @default(dbgenerated("extensions.uuid_generate_v4()")) @db.Uuid
  nombre           String
  documento_id     String        @unique @map("documento_id")
  rol              String?
  email            String?       @unique
  pin_seguridad    String?       @unique @map("pin_seguridad")
  telegram_token   String?       @unique @map("telegram_token")
  telegram_token_expira DateTime? @map("telegram_token_expira")
  
  // Relación con la tabla de Telegram
  telegram_usuario TelegramUser?

  @@map("empleados")
}

model TelegramUser {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  empleado_id    String?   @unique @db.Uuid
  chat_id        String    @unique @map("chat_id")
  nombre         String?
  username       String?
  token_unico    String?   @unique @map("token_unico")
  activo         Boolean?  @default(true)
  ultimo_mensaje DateTime? @map("ultimo_mensaje")
  created_at     DateTime? @default(now()) @map("created_at")
  updated_at     DateTime? @default(now()) @map("updated_at")

  // Relación inversa
  employee       Employee? @relation(fields: [empleado_id], references: [id])

  @@map("telegram_usuarios")
}
```

```typescript
// 2. lib/telegram-service.ts
import prisma from './prisma';
import crypto from 'crypto';

/**
 * Genera el link de Telegram para un empleado.
 * Reutiliza el token si ya existe para evitar redundancia. [2]
 */
export async function getTelegramSetupLink(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { telegram_token: true }
  });

  if (!employee) throw new Error("Empleado no encontrado");

  // Si no tiene token, generamos uno seguro de 40 caracteres (límite de Telegram: 64) [3, 4]
  let token = employee.telegram_token;
  
  if (!token) {
    token = crypto.randomBytes(20).toString('hex');
    await prisma.employee.update({
      where: { id: employeeId },
      data: { telegram_token: token }
    });
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USER; // notificaacceso_bot
  return `https://t.me/${botUsername}?start=${token}`;
}
```

```typescript
// 3. app/api/webhook/telegram/route.ts
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import prisma from '@/lib/prisma';

// Inicializamos el bot con el token de entorno [5, 6]
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Manejamos el comando /start que viene del link del correo 
bot.command("start", async (ctx) => {
  const token = ctx.match; // Aquí grammY extrae automáticamente el payload del link 

  if (!token) {
    return ctx.reply("Bienvenido al sistema de notificaciones. Por favor, usa el link que recibiste en tu correo.");
  }

  // Creamos el teclado con el botón de confirmación solicitado [7, 8]
  const keyboard = new InlineKeyboard()
   .text("Confirmación de correo recibido", `confirm_${token}`);

  await ctx.reply(`Hola ${ctx.from?.first_name |

| 'Empleado'}. Para vincular tu cuenta y recibir tus horarios, presiona el botón de confirmación:`, {
    reply_markup: keyboard
  });
});

// Manejamos el clic en el botón 
bot.callbackQuery(/confirm_(.+)/, async (ctx) => {
  const token = ctx.match[1]; // Extraemos el token del callback_data
  const telegramData = ctx.from;

  try {
    // Buscamos al empleado por su token
    const employee = await prisma.employee.findUnique({
      where: { telegram_token: token }
    });

    if (!employee) {
      return ctx.answerCallbackQuery({ text: "Token inválido o expirado.", show_alert: true });
    }

    // Vinculamos o actualizamos en telegram_usuarios [1, 9]
    await prisma.telegramUser.upsert({
      where: { chat_id: telegramData.id.toString() },
      update: {
        empleado_id: employee.id,
        nombre: telegramData.first_name,
        username: telegramData.username,
        token_unico: token,
        updated_at: new Date()
      },
      create: {
        empleado_id: employee.id,
        chat_id: telegramData.id.toString(),
        nombre: telegramData.first_name,
        username: telegramData.username,
        token_unico: token
      }
    });

    // Respondemos a Telegram y enviamos mensaje final [7, 10]
    await ctx.answerCallbackQuery({ text: "¡Cuenta vinculada con éxito!" });
    await ctx.editMessageText("✅ ¡Listo! Tu correo ha sido verificado. A partir de ahora recibirás aquí tus horarios y días de descanso.");
    
  } catch (error) {
    console.error("Error vinculando Telegram:", error);
    await ctx.answerCallbackQuery({ text: "Hubo un error al procesar tu solicitud.", show_alert: true });
  }
});

// Exportamos el webhook para Next.js App Router 
export const POST = webhookCallback(bot, "std/http");