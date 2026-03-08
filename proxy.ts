import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proteger rutas admin - requiere usuario autenticado
  if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/personal/login';
    return NextResponse.redirect(url);
  }

  // Proteger rutas de empleado - requiere usuario autenticado
  if (request.nextUrl.pathname.startsWith('/empleado') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/personal/login';
    return NextResponse.redirect(url);
  }

  // Si ya está autenticado y va al login, redirigir al selector
  if (user && request.nextUrl.pathname === '/personal/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/selector';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};