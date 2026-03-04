import AdminProvider from '../admin/AdminProvider';

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
    return <AdminProvider>{children}</AdminProvider>;
}
