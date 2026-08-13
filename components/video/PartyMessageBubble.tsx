"use client";

import { Fragment } from "react";
import type { WatchPartyMessage } from "@/lib/core/contracts";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";
import { partyAttachmentSrc } from "@/lib/party/partyAttachment";
import { partyAuthorColor } from "@/lib/party/partyAuthorColor";
import type { PartyFeedGroup } from "@/lib/party/partyFeed";

const formatClockTime = (ms: number) =>
    new Date(ms).toLocaleTimeString("pl", { hour: "2-digit", minute: "2-digit" });

interface PartyAttachmentProps {
    roomCode: string;
    message: WatchPartyMessage;
    author: string;
}

const PartyAttachment = ({ roomCode, message, author }: PartyAttachmentProps) => (
    <a
        className="np-party-shot"
        href={partyAttachmentSrc(roomCode, message.attachmentUrl ?? "")}
        target="_blank"
        rel="noreferrer noopener"
    >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
            src={partyAttachmentSrc(roomCode, message.attachmentUrl ?? "")}
            alt={`${message.attachmentKind === "gif" ? "GIF" : "Obraz"} od ${author}`}
            loading="lazy"
            referrerPolicy="no-referrer"
        />
    </a>
);

interface PartyBurstProps {
    roomCode: string;
    group: Extract<PartyFeedGroup, { kind: "burst" }>;
    avatar: string | null;
}

export const PartyBurst = ({ roomCode, group, avatar }: PartyBurstProps) => {
    const color = partyAuthorColor(group.profileId);

    if (group.own) {
        return (
            <div className="np-party-mine">
                {group.messages.map((message) => (
                    <Fragment key={message.id}>
                        {message.attachmentUrl && (
                            <PartyAttachment roomCode={roomCode} message={message} author="Ciebie" />
                        )}
                        {message.body !== "" && <p className="np-party-line">{message.body}</p>}
                    </Fragment>
                ))}
                <time>{formatClockTime(group.atMs)}</time>
            </div>
        );
    }

    return (
        <div className="np-party-burst">
            <ProfileAvatarTile
                avatar={avatar ?? group.avatar}
                name={group.name}
                className="np-party-burst-avatar"
            />
            <div className="np-party-burst-lines">
                <span className="np-party-byline">
                    <b style={{ color }}>{group.name}</b>
                    <time>{formatClockTime(group.atMs)}</time>
                </span>
                {group.messages.map((message) => (
                    <Fragment key={message.id}>
                        {message.attachmentUrl && (
                            <PartyAttachment roomCode={roomCode} message={message} author={group.name} />
                        )}
                        {message.body !== "" && <p className="np-party-line">{message.body}</p>}
                    </Fragment>
                ))}
            </div>
        </div>
    );
};

export const PartyNoticeLine = ({ text, parting }: { text: string; parting?: boolean }) => (
    <p className="np-party-notice" data-kind={parting ? "left" : undefined}>{text}</p>
);

interface PartyTypingBubbleProps {
    name: string;
    avatar: string | null;
}

export const PartyTypingBubble = ({ name, avatar }: PartyTypingBubbleProps) => (
    <div className="np-party-typing" aria-live="polite">
        <ProfileAvatarTile avatar={avatar} name={name} className="np-party-burst-avatar" />
        <span className="np-party-typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
        </span>
        <span className="sr-only">{name} pisze wiadomość</span>
    </div>
);

interface PartyFloatMessageProps {
    roomCode: string;
    group: Extract<PartyFeedGroup, { kind: "burst" }>;
    avatar: string | null;
}

export const PartyFloatMessage = ({ roomCode, group, avatar }: PartyFloatMessageProps) => {
    const color = partyAuthorColor(group.profileId);
    const message = group.messages.at(-1);
    if (message === undefined) return null;

    return (
        <div className="np-party-float">
            <ProfileAvatarTile
                avatar={avatar ?? group.avatar}
                name={group.name}
                className="np-party-float-avatar"
            />
            <p>
                <b style={{ color }}>{group.own ? "Ty" : group.name}</b>
                {message.body}
                {message.attachmentUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={partyAttachmentSrc(roomCode, message.attachmentUrl)}
                        alt={message.attachmentKind === "gif" ? "GIF" : "Obraz"}
                        referrerPolicy="no-referrer"
                    />
                )}
            </p>
        </div>
    );
};
