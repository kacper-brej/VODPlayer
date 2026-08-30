"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, ImagePlus, MoreHorizontal, Send, X } from "lucide-react";
import type {
    WatchPartyControlMode,
    WatchPartyMember,
    WatchPartyRole,
} from "@/lib/core/contracts";
import type { PartySyncQuality } from "@/lib/party/usePartySync";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";
import { PARTY_MESSAGE_MAX_LENGTH } from "@/lib/party/partyMessageLimits";
import { partyAttachmentSrc } from "@/lib/party/partyAttachment";
import { partyAuthorColor } from "@/lib/party/partyAuthorColor";
import { groupPartyFeed, type PartyFeedEntry, type PartyUploadResult } from "@/lib/party/partyFeed";
import {
    PartyBurst,
    PartyNoticeLine,
    PartyTypingBubble,
} from "@/components/video/PartyMessageBubble";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const NEAR_BOTTOM_THRESHOLD_PX = 48;
const MAX_STACKED_AVATARS = 3;
const PANEL_OPACITY_STORAGE_KEY = "nocturna:party-panel-opacity";
const DEFAULT_PANEL_OPACITY = 72;
const TYPING_SIGNAL_INTERVAL_MS = 2500;

const clampPanelOpacity = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const syncLabel = (quality: PartySyncQuality) => {
    if (quality === "synchronized") return "Wszyscy oglądają to samo";
    if (quality === "correcting") return "Wyrównuję moment odtwarzania";
    return "Ktoś odstaje od reszty";
};

interface PartyChatPanelProps {
    open: boolean;
    roomCode: string;
    feed: PartyFeedEntry[];
    participants: WatchPartyMember[];
    viewerProfileId: number;
    viewerRole: WatchPartyRole;
    controlMode: WatchPartyControlMode;
    syncQuality: PartySyncQuality;
    typingProfileIds: number[];
    overlayMessages: boolean;
    onSend: (body: string, attachmentUrl: string | null) => Promise<boolean>;
    onUploadImage: (file: File) => Promise<PartyUploadResult>;
    onTyping?: () => void;
    onOverlayMessagesChange: (enabled: boolean) => void;
    onTransferHost: (profileId: number) => Promise<boolean>;
    onControlModeChange: (controlMode: WatchPartyControlMode) => Promise<boolean>;
    onOpenChange?: (open: boolean) => void;
}

export const PartyChatPanel = ({
    open,
    roomCode,
    feed,
    participants,
    viewerProfileId,
    viewerRole,
    controlMode,
    syncQuality,
    typingProfileIds,
    overlayMessages,
    onSend,
    onUploadImage,
    onTyping,
    onOverlayMessagesChange,
    onTransferHost,
    onControlModeChange,
    onOpenChange,
}: PartyChatPanelProps) => {
    const [panelOpacity, setPanelOpacity] = useState(DEFAULT_PANEL_OPACITY);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [attachmentDraft, setAttachmentDraft] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const riverRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stickToBottomRef = useRef(true);
    const lastTypingSignalRef = useRef(0);
    const dragDepthRef = useRef(0);

    useEffect(() => {
        const stored = window.localStorage.getItem(PANEL_OPACITY_STORAGE_KEY);
        if (stored === null || !Number.isFinite(Number(stored))) return;
        const frame = window.requestAnimationFrame(() => setPanelOpacity(clampPanelOpacity(Number(stored))));
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (sheetOpen) setSheetOpen(false);
            else onOpenChange?.(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange, open, sheetOpen]);

    useEffect(() => {
        if (!sheetOpen) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!sheetRef.current?.contains(event.target as Node)) setSheetOpen(false);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [sheetOpen]);

    useEffect(() => {
        const node = riverRef.current;
        if (!node || !stickToBottomRef.current) return;
        node.scrollTop = node.scrollHeight;
    }, [feed, typingProfileIds]);

    const handleScroll = () => {
        const node = riverRef.current;
        if (!node) return;
        stickToBottomRef.current =
            node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
    };

    const participantByProfileId = (profileId: number) =>
        participants.find((participant) => participant.profileId === profileId) ?? null;

    const newestHeartbeat = participants.length > 0
        ? Math.max(...participants.map((participant) => participant.lastSeenAtMs))
        : 0;

    const participantState = (participant: WatchPartyMember) => {
        if (participant.isBuffering) return "Buforuje";
        if (newestHeartbeat - participant.lastSeenAtMs > 30_000) return "Odstaje";
        return participant.role === "host" ? "Host" : "Zsynchronizowany";
    };

    const handleOpacityChange = (value: number) => {
        const next = clampPanelOpacity(value);
        setPanelOpacity(next);
        window.localStorage.setItem(PANEL_OPACITY_STORAGE_KEY, String(next));
    };

    const handleClose = () => {
        setSheetOpen(false);
        onOpenChange?.(false);
    };

    const handleCopyInvite = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const handleDraftChange = (value: string) => {
        setDraft(value);
        const now = Date.now();
        if (value.trim() === "" || now - lastTypingSignalRef.current < TYPING_SIGNAL_INTERVAL_MS) return;
        lastTypingSignalRef.current = now;
        onTyping?.();
    };

    const handleFile = async (file: File | null | undefined) => {
        if (!file || uploading) return;
        setUploading(true);
        setError(null);
        const result = await onUploadImage(file);
        setUploading(false);
        if (result.ok) setAttachmentDraft(result.storageKey);
        else setError(result.message);
    };

    const handleDrop = (event: ReactDragEvent) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragActive(false);
        void handleFile(Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const body = draft.trim();
        if ((body === "" && attachmentDraft === null) || sending) return;

        setSending(true);
        setError(null);
        stickToBottomRef.current = true;

        const ok = await onSend(body, attachmentDraft);
        setSending(false);
        if (ok) {
            setDraft("");
            setAttachmentDraft(null);
        } else {
            setError("Nie udało się wysłać wiadomości. Spróbuj ponownie.");
        }
    };

    const groups = groupPartyFeed(feed, viewerProfileId);
    const visibleParticipants = participants.slice(0, MAX_STACKED_AVATARS);
    const overflow = participants.length - visibleParticipants.length;
    const remaining = PARTY_MESSAGE_MAX_LENGTH - draft.length;
    const typingAuthors = typingProfileIds
        .filter((profileId) => profileId !== viewerProfileId)
        .map((profileId) => participantByProfileId(profileId));

    const panelStyle = {
        "--np-party-panel-opacity": String(panelOpacity / 100),
    } as CSSProperties;
    const rangeStyle = { "--np-party-range-fill": `${panelOpacity}%` } as CSSProperties;

    return (
        <div className="np-party-chat" style={panelStyle}>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.aside
                        aria-label="Panel Watch Party"
                        className="np-party-panel"
                        data-drop={dragActive || undefined}
                        initial={{ opacity: 0, x: 28, scale: 0.99 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 28, scale: 0.99 }}
                        transition={{ duration: 0.24, ease: EASE_OUT }}
                        onDragEnter={(event) => {
                            if (!Array.from(event.dataTransfer.types).includes("Files")) return;
                            dragDepthRef.current += 1;
                            setDragActive(true);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => {
                            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                            if (dragDepthRef.current === 0) setDragActive(false);
                        }}
                        onDrop={handleDrop}
                    >
                        {dragActive && (
                            <div className="np-party-drop" aria-hidden="true">
                                <ImagePlus />
                                <span>Upuść obraz, żeby go wysłać</span>
                            </div>
                        )}

                        <div className="np-party-bar">
                            <span
                                className="np-party-live"
                                data-quality={syncQuality}
                                role="status"
                                title={syncLabel(syncQuality)}
                            >
                                <span className="sr-only">{syncLabel(syncQuality)}</span>
                            </span>

                            <button
                                type="button"
                                className="np-party-code"
                                onClick={() => void handleCopyInvite()}
                                aria-label="Kopiuj link zaproszenia do pokoju"
                            >
                                {roomCode.toUpperCase()}
                            </button>
                            {copied && <span className="np-party-copied">Skopiowano</span>}

                            <span
                                className="np-party-stack"
                                role="group"
                                aria-label={`W pokoju: ${participants.length}`}
                            >
                                {visibleParticipants.map((participant) => (
                                    <span
                                        key={participant.profileId}
                                        className="np-party-stack-item"
                                        data-host={participant.role === "host" || undefined}
                                        title={`${participant.name} — ${participantState(participant).toLowerCase()}`}
                                    >
                                        <ProfileAvatarTile
                                            avatar={participant.avatar}
                                            name={participant.name}
                                            className="np-party-stack-avatar"
                                        />
                                    </span>
                                ))}
                                {overflow > 0 && <span className="np-party-stack-rest">+{overflow}</span>}
                            </span>

                            <button
                                type="button"
                                className="np-party-more"
                                aria-label="Ustawienia pokoju"
                                aria-expanded={sheetOpen}
                                aria-haspopup="dialog"
                                onClick={() => setSheetOpen((value) => !value)}
                            >
                                <MoreHorizontal />
                            </button>

                            {onOpenChange && (
                                <button
                                    type="button"
                                    className="np-party-close"
                                    aria-label="Schowaj czat Watch Party"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={handleClose}
                                >
                                    <X />
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {sheetOpen && (
                                <motion.div
                                    ref={sheetRef}
                                    className="np-party-sheet"
                                    role="dialog"
                                    aria-label="Ustawienia pokoju"
                                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                    transition={{ duration: 0.18, ease: EASE_OUT }}
                                >
                                    <h4>Panel</h4>
                                    <div className="np-party-sheet-row">
                                        <label htmlFor="np-party-panel-opacity">Krycie tła</label>
                                        <output htmlFor="np-party-panel-opacity">{panelOpacity}%</output>
                                    </div>
                                    <input
                                        id="np-party-panel-opacity"
                                        className="np-party-range"
                                        style={rangeStyle}
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={panelOpacity}
                                        aria-label="Krycie tła panelu"
                                        onChange={(event) => handleOpacityChange(Number(event.target.value))}
                                    />

                                    <div className="np-party-sheet-row">
                                        <span id="np-party-overlay-label">Wiadomości na ekranie</span>
                                        <button
                                            type="button"
                                            className="np-party-switch"
                                            aria-pressed={overlayMessages}
                                            aria-labelledby="np-party-overlay-label"
                                            onClick={() => onOverlayMessagesChange(!overlayMessages)}
                                        />
                                    </div>

                                    <div className="np-party-rule" />

                                    <h4>Sterowanie odtwarzaniem</h4>
                                    {viewerRole === "host" ? (
                                        <div className="np-party-seg">
                                            <button
                                                type="button"
                                                aria-pressed={controlMode === "host"}
                                                onClick={() => void onControlModeChange("host")}
                                            >
                                                Host
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={controlMode === "everyone"}
                                                onClick={() => void onControlModeChange("everyone")}
                                            >
                                                Wszyscy
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="np-party-sheet-note">
                                            {controlMode === "host" ? "Odtwarzaniem steruje host" : "Steruje każdy w pokoju"}
                                        </p>
                                    )}

                                    <div className="np-party-rule" />

                                    <h4>W pokoju</h4>
                                    {participants.map((participant) => {
                                        const state = participantState(participant);
                                        const canTransferHost = viewerRole === "host"
                                            && participant.profileId !== viewerProfileId
                                            && participant.role !== "host";
                                        return (
                                            <div key={participant.profileId} className="np-party-who">
                                                <ProfileAvatarTile
                                                    avatar={participant.avatar}
                                                    name={participant.name}
                                                    className="np-party-who-avatar"
                                                />
                                                <span style={{ color: partyAuthorColor(participant.profileId) }}>
                                                    {participant.profileId === viewerProfileId ? "Ty" : participant.name}
                                                </span>
                                                {participant.role === "host" && (
                                                    <Crown aria-label="Host" width={11} height={11} />
                                                )}
                                                {canTransferHost ? (
                                                    <button
                                                        type="button"
                                                        className="np-party-who-state"
                                                        onClick={() => void onTransferHost(participant.profileId)}
                                                    >
                                                        Przekaż
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="np-party-who-state"
                                                        data-warning={state === "Odstaje" || undefined}
                                                    >
                                                        {state}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div
                            ref={riverRef}
                            className="np-party-river"
                            onScroll={handleScroll}
                            aria-label="Rozmowa w pokoju"
                        >
                            {groups.length === 0 && (
                                <p className="np-party-empty">Napisz coś jako pierwszy.</p>
                            )}
                            {groups.map((group) => group.kind === "notice"
                                ? <PartyNoticeLine key={group.id} text={group.text} parting={group.parting} />
                                : (
                                    <PartyBurst
                                        key={group.id}
                                        roomCode={roomCode}
                                        group={group}
                                        avatar={participantByProfileId(group.profileId)?.avatar ?? null}
                                    />
                                ))}
                            {typingAuthors.map((participant, index) => (
                                <PartyTypingBubble
                                    key={`typing-${participant?.profileId ?? index}`}
                                    name={participant?.name ?? "Widz"}
                                    avatar={participant?.avatar ?? null}
                                />
                            ))}
                        </div>

                        {error && <p className="np-party-error" role="alert">{error}</p>}

                        {uploading && !attachmentDraft && (
                            <span className="np-party-draft-progress">Wysyłam obraz…</span>
                        )}

                        {attachmentDraft && (
                            <div className="np-party-draft">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={partyAttachmentSrc(roomCode, attachmentDraft)}
                                    alt="Podgląd załącznika"
                                    referrerPolicy="no-referrer"
                                />
                                <button
                                    type="button"
                                    aria-label="Usuń załącznik"
                                    onClick={() => setAttachmentDraft(null)}
                                >
                                    <X />
                                </button>
                            </div>
                        )}

                        <form className="np-party-compose" onSubmit={handleSubmit}>
                            <label className="sr-only" htmlFor="np-party-chat-input">
                                Wiadomość do pokoju
                            </label>
                            <div className="np-party-field">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="sr-only"
                                    onChange={(event) => {
                                        void handleFile(event.target.files?.[0]);
                                        event.target.value = "";
                                    }}
                                />
                                <button
                                    type="button"
                                    className="np-party-icon"
                                    aria-label="Wyślij obraz z dysku"
                                    disabled={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <ImagePlus />
                                </button>
                                <textarea
                                    id="np-party-chat-input"
                                    className="np-party-input"
                                    placeholder="Napisz wiadomość…"
                                    value={draft}
                                    maxLength={PARTY_MESSAGE_MAX_LENGTH}
                                    rows={1}
                                    onChange={(event) => handleDraftChange(event.target.value)}
                                    onPaste={(event) => {
                                        const file = Array.from(event.clipboardData.files)
                                            .find((item) => item.type.startsWith("image/"));
                                        if (!file) return;
                                        event.preventDefault();
                                        void handleFile(file);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault();
                                            event.currentTarget.form?.requestSubmit();
                                        }
                                    }}
                                />
                                {remaining <= 40 && <span className="np-party-counter">{remaining}</span>}
                                <button
                                    type="submit"
                                    className="np-party-send"
                                    disabled={sending || uploading || (draft.trim() === "" && attachmentDraft === null)}
                                    aria-label="Wyślij wiadomość"
                                >
                                    <Send />
                                </button>
                            </div>
                            <p className="np-party-hint">
                                Obraz możesz też przeciągnąć na panel albo wkleić ze schowka
                            </p>
                        </form>
                    </motion.aside>
                )}
            </AnimatePresence>
        </div>
    );
};
