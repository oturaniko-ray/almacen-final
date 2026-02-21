import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('user_session')?.value;
  const path = request.nextUrl.pathname;

  // Rutas públicas (sin autenticación)
  if (path === '/' || path === '/api/auth/login') {
    return NextResponse.next();
  }

  // Proteger rutas de admin
  if (path.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    try {
      const user = JSON.parse(session);
      const urlMatch = path.match(/\/admin\/provincia\/([^\/]+)/);
      const urlProvinciaId = urlMatch?.[1];

      // Admin central puede acceder a todo
      if (user.rol === 'admin_central') {
        return NextResponse.next();
      }

      // Admin provincial solo puede acceder a su provincia
      if (user.rol === 'admin_provincia') {
        // Si está intentando acceder a una provincia específica
        if (urlProvinciaId) {
          if (urlProvinciaId !== user.provinciaId) {
            // Redirigir a su propia provincia
            return NextResponse.redirect(
              new URL(`/admin/provincia/${user.provinciaId}`, request.url)
            );
          }
        }
        return NextResponse.next();
      }

      // Empleados y choferes (si tienen acceso limitado)
      return NextResponse.next();

    } catch (error) {
      // Sesión inválida
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*']
};