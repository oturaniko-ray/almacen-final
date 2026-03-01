import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Esta ruta registra el webhook del bot de Telegram apuntando a tu URL de Vercel.
// Llámala una sola vez: GET https://tu-app.vercel.app/api/setup-telegram-webhook
export async function GET() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;

    if (!botToken) {
        return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 });
    }

    if (!appUrl) {
        return NextResponse.json({
            success: false,
            error: 'Configura NEXT_PUBLIC_APP_URL en las variables de entorno de Vercel (ej: https://tu-app.vercel.app)'
        }, { status: 500 });
    }

    // Normalizar URL (quitar trailing slash, asegurarse de que sea https)
    const baseUrl = appUrl.startsWith('http') ? appUrl.replace(/\/$/, '') : `https://${appUrl.replace(/\/$/, '')}`;
    const webhookUrl = `${baseUrl}/api/telegram-webhook`;

    try {
        // 1. Registrar el webhook en Telegram
        const setRes = await fetch(
            `https://api.telegram.org/bot${botToken}/setWebhook`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: webhookUrl,
                    allowed_updates: ['message', 'callback_query'],
                }),
            }
        );
        const setData = await setRes.json();

        // 2. Verificar el estado actual del webhook
        const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const infoData = await infoRes.json();

        return NextResponse.json({
            success: setData.ok,
            message: setData.ok
                ? `✅ Webhook registrado correctamente en: ${webhookUrl}`
                : `❌ Error al registrar: ${setData.description}`,
            webhook_info: infoData.result,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
