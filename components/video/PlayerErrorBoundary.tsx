"use client";

import { Component, ReactNode } from "react";

interface PlayerErrorBoundaryProps {
    children: ReactNode;
    onRetry: () => void;
}

interface PlayerErrorBoundaryState {
    hasError: boolean;
}

class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
    state: PlayerErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.error("Odtwarzacz wideo napotkał błąd:", error);
    }

    handleReload = () => {
        this.setState({ hasError: false });
        this.props.onRetry();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 text-foreground">
                    <p className="text-sm text-muted">Odtwarzacz napotkał błąd.</p>
                    <button
                        onClick={this.handleReload}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover rounded-md font-semibold cursor-pointer transition-colors"
                    >
                        Odśwież odtwarzacz
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default PlayerErrorBoundary;
