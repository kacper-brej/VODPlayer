"use client"
type AuthContextType = {
    user: AuthUser | null,
    error: DataErrorReason | null,
    loading: boolean,
    refreshUser: () => Promise<void>,
    logout: () => Promise<void>,
};
import { useState, useEffect, useContext, createContext, useCallback, type ReactNode } from "react";
import clearSessionCookieAction from "@/lib/clearSessionCookieAction";
import { validateMeResponse, type AuthUser } from "@/lib/contracts";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataErrorReason,
    type DataResult,
} from "@/lib/dataResult";

const AuthContext = createContext<AuthContextType>({
    user: null,
    error: null,
    loading: true,
    refreshUser: async () => {},
    logout: async () => {},
});

export const fetchCurrentUser = async (): Promise<DataResult<AuthUser | null>> => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me.php`, {
            credentials: 'include',
        });

        if (!res.ok) return failureFromStatus(res.status);

        const payload: unknown = await res.json();
        const result = validateMeResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data.user);
    } catch {
        return dataFailure("network");
    }
};

export const AuthProvider = ({children}: {children: ReactNode}) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [error, setError] = useState<DataErrorReason | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        const result = await fetchCurrentUser();

        if (result.kind === "error") {
            setUser(null);
            setError(result.reason);
            return;
        }

        setUser(result.data);
        setError(null);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/logout.php`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch {
            // brak połączenia z serwerem sesja i tak wsm jest czysczcona lokalnie
        } finally {
            await clearSessionCookieAction();
            setUser(null);
            setError(null);
        }
    }, []);

    useEffect(() => {
        let active = true;

        fetchCurrentUser().then((result) => {
            if (!active) return;

            if (result.kind === "error") {
                setUser(null);
                setError(result.reason);
            } else {
                setUser(result.data);
                setError(null);
            }

            setLoading(false);
        });

        return () => {
            active = false;
        };
    }, []);

    return (
        <AuthContext.Provider value={{user, error, loading, refreshUser, logout}}>
            {children}
        </AuthContext.Provider>
    )

}

export const useAuth = () => {
    return useContext(AuthContext);
}
