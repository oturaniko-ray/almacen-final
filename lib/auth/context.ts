import { createContext, useContext } from 'react';

export type UserRole = 'admin_central' | 'admin_provincia' | 'empleado' | 'chofer';

export interface UserContextType {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  nivel_acceso?: number; // ✅ AÑADIDO (opcional)
  provinciaId: string | null;
  provinciaNombre?: string;
}

export const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser debe usarse dentro de UserProvider');
  }
  return context;
};