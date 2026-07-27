"use client"
type User = {id: number, username: string, email: string};
type AuthContextType = {
    user: User | null,
    loading: boolean,
    refreshUser: () => Promise<void>,
    logout: () => Promise<void>,
};
import { useState, useEffect, useContext, createContext, useCallback, type ReactNode } from "react";
import clearSessionCookieAction from "@/lib/clearSessionCookieAction";

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    refreshUser: async () => {},
    logout: async () => {},
});

export const AuthProvider = ({children}: {children: ReactNode}) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me.php`, {
                credentials: 'include',
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/logout.php`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch {
            // brak połączenia z serwerem i tak czyścimy sesję lokalnie
        } finally {
            await clearSessionCookieAction();
            setUser(null);
        }
    }, []);

    useEffect(() => {
        refreshUser().finally(() => setLoading(false));
    }, [refreshUser]);

    return (
        <AuthContext.Provider value={{user, loading, refreshUser, logout}}>
            {children}
        </AuthContext.Provider>
    )

}

export const useAuth = () => {
    return useContext(AuthContext);
}