export const PARTY_AUTHOR_COLORS = [
    "#B9A0FF",
    "#D8FF72",
    "#FF9E7D",
    "#7FD8FF",
    "#FFC978",
    "#9CE8C0",
] as const;

export const partyAuthorColor = (profileId: number): string => {
    const index = Number.isSafeInteger(profileId) ? Math.abs(profileId) % PARTY_AUTHOR_COLORS.length : 0;
    return PARTY_AUTHOR_COLORS[index] ?? PARTY_AUTHOR_COLORS[0];
};
