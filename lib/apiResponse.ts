import { NextResponse } from 'next/server';

export function successResponse(data: any = null, message = 'Operación exitosa', status = 200) {
    return NextResponse.json(
        {
            success: true,
            data,
            message,
        },
        { status }
    );
}

export function errorResponse(error: unknown, defaultMessage = 'Ocurrió un error inesperado', status = 500) {
    console.error('API Error:', error);

    let errorMessage = defaultMessage;
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    // Si el error tiene status propio, usarlo
    const statusCode = (error as any)?.status || status;

    return NextResponse.json(
        {
            success: false,
            error: errorMessage,
        },
        { status: statusCode }
    );
}
