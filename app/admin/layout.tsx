// Todas las páginas de admin requieren autenticación y datos en tiempo real.
// NO deben prerenderizarse estáticamente durante el build.
export const dynamic = 'force-dynamic';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}