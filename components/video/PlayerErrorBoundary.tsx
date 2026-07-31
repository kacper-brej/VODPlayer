"use client";

import { Component, ReactNode } from "react";

interface PlayerErrorBoundaryProps {
    children: ReactNode;
    onRetry: () => void;
    onBack?: () => void;
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
                <div className="np-player-boundary" role="alert">
                    <div className="np-error-panel">
                        <div className="np-error-copy">
                            <h2>Odtwarzacz napotkał błąd</h2>
                            <p>Nie udało się uruchomić interfejsu odtwarzania.</p>
                        </div>
                        <div className="np-error-actions">
                            <button type="button" onClick={this.handleReload} className="np-error-primary">
                                Odśwież odtwarzacz
                            </button>
                            {this.props.onBack && (
                                <button type="button" onClick={this.props.onBack} className="np-error-secondary">
                                    Wróć do serialu
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default PlayerErrorBoundary;
