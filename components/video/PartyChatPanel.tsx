"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import type { WatchPartyMember, WatchPartyMessage } from "@/lib/core/contracts";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";
import { useModalFocus } from "@/lib/core/useModalFocus";
import { PARTY_MESSAGE_MAX_LENGTH } from "@/lib/party/partyMessageLimits";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const NEAR_BOTTOM_THRESHOLD_PX = 48;

const formatClockTime = (ms: number) =>
    new Date(ms).toLocaleTimeString("pl", { hour: "2-digit", minute: "2-digit" });

interface PartyChatPanelProps {
    messages: WatchPartyMessage[];
    participants: WatchPartyMember[];
    viewerProfileId: number;
    unreadCount: number;
    onSend: (body: string) => Promise<boolean>;
    onOpenChange?: (open: boolean) => void;
}

export const PartyChatPanel = ({
    messages,
    participants,
    viewerProfileId,
    unreadCount,
    onSend,
    onOpenChange,
}: PartyChatPanelProps) => {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottomRef = useRef(true);

    const close = () => {
        setOpen(false);
        onOpenChange?.(false);
    };
    const dialogRef = useModalFocus<HTMLDivElement>(open, close);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        onOpenChange?.(next);
    };

    useEffect(() => {
        const node = scrollRef.current;
        if (!node || !stickToBottomRef.current) return;
        node.scrollTop = node.scrollHeight;
    }, [messages]);

    const handleScroll = () => {
        const node = scrollRef.current;
        if (!node) return;
        const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
        stickToBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    };

    const participantByProfileId = (profileId: number) =>
        participants.find((participant) => participant.profileId === profileId) ?? null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const body = draft.trim();
        if (body === "" || sending) return;

        setSending(true);
        setError(null);
        stickToBottomRef.current = true;

        const ok = await onSend(body);
        setSending(false);
        if (ok) setDraft("");
        else setError("Nie udało się wysłać wiadomości. Spróbuj ponownie.");
    };

    const remaining = PARTY_MESSAGE_MAX_LENGTH - draft.length;

    return (
        <div className="np-party-chat">
            <button
                type="button"
                className="np-party-chat-toggle"
                aria-expanded={open}
                aria-label={open ? "Zamknij czat pokoju" : "Otwórz czat pokoju"}
                onClick={toggle}
            >
                <MessageCircle />
                {!open && unreadCount > 0 && (
                    <span className="np-party-chat-badge" aria-hidden="true">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Czat pokoju"
                        className="np-party-chat-panel"
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ duration: 0.22, ease: EASE_OUT }}
                        tabIndex={-1}
                    >
                        <div className="np-party-chat-header">
                            <span>Czat</span>
                            <button
                                type="button"
                                className="np-party-chat-close"
                                aria-label="Zamknij czat pokoju"
                                onClick={close}
                            >
                                <X />
                            </button>
                        </div>

                        <div
                            ref={scrollRef}
                            className="np-party-chat-messages"
                            onScroll={handleScroll}
                        >
                            {messages.length === 0 && (
                                <p className="np-party-chat-empty">
                                    Napisz coś jako pierwszy.
                                </p>
                            )}
                            {messages.map((message) => {
                                const participant = participantByProfileId(message.profileId);
                                const own = message.profileId === viewerProfileId;
                                const name = participant?.name ?? "Widz";

                                return (
                                    <div
                                        key={message.id}
                                        className="np-party-chat-message"
                                        data-own={own || undefined}
                                    >
                                        <ProfileAvatarTile
                                            avatar={participant?.avatar ?? null}
                                            name={name}
                                            className="np-party-chat-avatar"
                                        />
                                        <div className="np-party-chat-bubble">
                                            <div className="np-party-chat-meta">
                                                <span className="np-party-chat-name">
                                                    {own ? "Ty" : name}
                                                </span>
                                                <span className="np-party-chat-time">
                                                    {formatClockTime(message.createdAtMs)}
                                                </span>
                                            </div>
                                            <p>{message.body}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {error && (
                            <p className="np-party-chat-error" role="alert">{error}</p>
                        )}

                        <form className="np-party-chat-compose" onSubmit={handleSubmit}>
                            <label className="sr-only" htmlFor="np-party-chat-input">
                                Wiadomość do pokoju
                            </label>
                            <textarea
                                id="np-party-chat-input"
                                className="np-party-chat-input"
                                placeholder="Napisz wiadomość…"
                                value={draft}
                                maxLength={PARTY_MESSAGE_MAX_LENGTH}
                                rows={1}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void handleSubmit(event);
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                className="np-party-chat-send"
                                disabled={sending || draft.trim() === ""}
                                aria-label="Wyślij wiadomość"
                            >
                                <Send />
                            </button>
                            {remaining <= 40 && (
                                <span className="np-party-chat-counter">{remaining}</span>
                            )}
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
