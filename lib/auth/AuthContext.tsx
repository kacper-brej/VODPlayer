"use client"
type AuthContextType = {
    user: AuthUser | null,
    error: DataErrorReason | null,
    loading: boolean,
    refreshUser: () => Promise<void>,
    setAuthenticatedUser: (user: AuthUser) => void,
    logout: () => Promise<boolean>,
};
import { useState, useEffect, useContext, createContext, useCallback, type ReactNode } from "react";
import { getCurrentUserAction, logoutAction } from "@/lib/auth/authActions";
import { clearRecentSearches } from "@/lib/search/recentSearches";
import { type AuthUser } from "@/lib/core/contracts";
import {
    dataFailure,
    dataSuccess,
    type DataErrorReason,
    type DataResult,
} from "@/lib/core/dataResult";

const AuthContext = createContext<AuthContextType>({
    user: null,
    error: null,
    loading: true,
    refreshUser: async () => {},
    setAuthenticatedUser: () => {},
    logout: async () => false,
});

export const fetchCurrentUser = async (): Promise<DataResult<AuthUser | null>> => {
    try {
        return dataSuccess(await getCurrentUserAction());
    } catch {
        return dataFailure("network");
    }
};

interface AuthProviderProps {
    children: ReactNode;
    initialUser?: AuthUser | null;
}

export const AuthProvider = ({children, initialUser}: AuthProviderProps) => {
    const hasInitialUser = initialUser !== undefined;
    const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
    const [error, setError] = useState<DataErrorReason | null>(null);
    const [loading, setLoading] = useState(!hasInitialUser);

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

    const setAuthenticatedUser = useCallback((nextUser: AuthUser) => {
        setUser(nextUser);
        setError(null);
    }, []);

    const logout = useCallback(async () => {
        try {
            const result = await logoutAction();
            if (!result.ok) {
                setError("server");
                return false;
            }
            clearRecentSearches();
            setUser(null);
            setError(null);
            return true;
        } catch {
            setError("network");
            return false;
        }
    }, []);

    useEffect(() => {
        if (hasInitialUser) return;

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
    }, [hasInitialUser]);

    return (
        <AuthContext.Provider value={{user, error, loading, refreshUser, setAuthenticatedUser, logout}}>
            {children}
        </AuthContext.Provider>
    )

}

export const useAuth = () => {
    return useContext(AuthContext);
}
