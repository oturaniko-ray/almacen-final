import AdminProvider from '../admin/AdminProvider';

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
    return <AdminProvider>{children}</AdminProvider>;
}
