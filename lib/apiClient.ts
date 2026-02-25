export const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
        const session = localStorage.getItem('user_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                if (user.id) headers['x-user-id'] = user.id;
                if (user.pin_seguridad) headers['x-user-pin'] = user.pin_seguridad;
            } catch (e) {
                console.error('Error parsing user session for headers', e);
            }
        }
    }

    return headers;
};
