import type { ProviderArtwork, ProviderSeries, SeriesCandidate } from "@/lib/metadata/types";

export type ContractResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

export type MediaAssetStatus =
    | "pending"
    | "processing"
    | "ready"
    | "failed"
    | "deleting"
    | "delete_failed"
    | "deleted";

export type MediaDelivery = "hls" | "file";

export interface EpisodeMediaStatus {
    assetId: number;
    assetVersion: number;
    status: MediaAssetStatus;
    delivery: MediaDelivery;
    heights: number[];
    previewStartSeconds: number | null;
    hasPreviewClip: boolean;
}

export interface CatalogEpisodePayload {
    key: string;
    number: number;
    sizeBytes: number;
    addedAt: number;
    title: string | null;
    synopsis: string | null;
    durationSeconds: number | null;
    thumbnail: string | null;
    media?: EpisodeMediaStatus | null;
}

export interface CatalogGenre {
    name: string;
    slug: string;
}

export type SeriesVisibility = "public" | "restricted" | "admin" | "system";

export type SeriesAccessLevel = "full" | "demo";

export interface CatalogSeriesPayload {
    id: number;
    key: string;
    title: string;
    updatedAt: number;
    groupId: number | null;
    baseTitle: string | null;
    seasonNumber: number | null;
    coverImage: string | null;
    posterImage: string | null;
    backdropImage: string | null;
    backdropSource: "jikan" | "manual" | null;
    logoImage: string | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    focalX: number | null;
    focalY: number | null;
    safeLeft: number | null;
    safeBottom: number | null;
    dominantColor: string | null;
    placeholder: string | null;
    posterDominantColor: string | null;
    posterPlaceholder: string | null;
    backdropDominantColor: string | null;
    backdropPlaceholder: string | null;
    studio: string | null;
    audioLanguages: string[];
    subtitleLanguages: string[];
    metadataProvider: string | null;
    externalId: number | null;
    tmdbExternalId: number | null;
    genres: CatalogGenre[];
    altTitles: string[];
    hasMetadata: boolean;
    visibility: SeriesVisibility;
    episodeCount: number;
    episodes: CatalogEpisodePayload[];
}

export interface CatalogResponse {
    generatedAt: number;
    series: CatalogSeriesPayload[];
}

export interface ResumePoint {
    seriesKey: string;
    episodeKey: string;
    positionSeconds: number;
    durationSeconds: number | null;
    updatedAt: number;
}

export interface ContinueProgressResponse {
    items: ResumePoint[];
}

export interface EpisodeProgress {
    positionSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
    updatedAt: number;
}

export interface SeriesResumePoint {
    episodeKey: string;
    positionSeconds: number;
    durationSeconds: number | null;
}

export interface SeriesProgressResponse {
    seriesKey: string;
    episodes: Record<string, EpisodeProgress>;
    resume: SeriesResumePoint | null;
}

export interface EpisodeProgressResponse {
    positionSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
}

export interface SaveProgressResponse {
    success: boolean;
    completed: boolean;
}

export type EpisodeChapterType = "intro" | "outro" | "recap";

export interface EpisodeChapter {
    startSeconds: number;
    endSeconds: number;
    type: EpisodeChapterType;
}

export interface WatchlistItem {
    seriesKey: string;
    addedAt: number;
}

export interface WatchlistResponse {
    profileId: number;
    items: WatchlistItem[];
}

export interface ToggleWatchlistResponse {
    success: boolean;
    seriesKey: string;
}

export interface CollectionSummary {
    id: number;
    name: string;
    createdAt: number;
    itemCount: number;
}

export interface CollectionsResponse {
    collections: CollectionSummary[];
}

export interface CollectionDetail {
    id: number;
    name: string;
    createdAt: number;
    items: string[];
}

export interface CreateCollectionResponse {
    id: number;
    name: string;
    createdAt: number;
}

export interface RenameCollectionResponse {
    id: number;
    name: string;
}

export interface DeleteCollectionResponse {
    success: boolean;
}

export interface AddCollectionItemResponse {
    success: boolean;
    seriesKey: string;
}

export interface RemoveCollectionItemResponse {
    success: boolean;
}

export interface NotificationItem {
    id: number;
    seriesKey: string;
    episodeKey: string;
    createdAt: number;
}

export interface NotificationsResponse {
    count: number;
    items: NotificationItem[];
}

export interface MarkNotificationsReadResponse {
    success: boolean;
}

export interface RankingItem {
    seriesKey: string;
    playCount: number;
    rank: number;
}

export interface RankingsResponse {
    period: string;
    items: RankingItem[];
}

export interface UploadTokenResponse {
    token: string;
    expiresAt: number;
    targetFolder: string;
    episodeNumber: number;
    fileName: string;
}

export interface Profile {
    id: number;
    name: string;
    isDefault: boolean;
    avatar: string | null;
}

export interface ProfilesResponse {
    profiles: Profile[];
}

export interface CreateProfileResponse {
    id: number;
    name: string;
    isDefault: boolean;
    avatar: string | null;
}

export interface RenameProfileResponse {
    id: number;
    name: string;
}

export interface DeleteProfileResponse {
    success: boolean;
}

export interface ProfileSettings {
    autoplayNext: boolean;
    autoPreviewsEnabled: boolean;
    skipIntroPrompt: boolean;
    preferredSubtitleLang: string | null;
    preferredAudioLang: string | null;
    defaultVolume: number;
    reduceData: boolean;
}

export interface SettingsResponse {
    profileId: number;
    settings: ProfileSettings;
}

export interface RequestEmailChangeResponse {
    success: boolean;
    message: string;
}

export type UserRole = "viewer" | "admin";

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role?: UserRole;
    onboardedAt: string | null;
}

export interface MeResponse {
    user: AuthUser;
}

export type WatchPartyState = "playing" | "paused";
export type WatchPartyControlMode = "host" | "everyone";
export type WatchPartyRole = "host" | "guest";

export interface WatchPartyAnchor {
    state: WatchPartyState;
    positionSeconds: number;
    anchorAtMs: number;
    anchorVersion: number;
}

export interface WatchPartyBufferingWait {
    profileId: number;
    startedAtMs: number;
    timeoutAtMs: number;
}

export interface WatchParty {
    id: number;
    roomCode: string;
    hostProfileId: number;
    seriesKey: string;
    episodeKey: string;
    controlMode: WatchPartyControlMode;
    anchor: WatchPartyAnchor;
    bufferingWait?: WatchPartyBufferingWait | null;
    bufferingCooldownUntilMs?: number | null;
    createdAtMs: number;
    expiresAtMs: number;
    closedAtMs: number | null;
}

export interface WatchPartySnapshot {
    party: WatchParty;
    serverNowMs: number;
}

export interface WatchPartyMember {
    profileId: number;
    name: string;
    avatar: string | null;
    role: WatchPartyRole;
    joinedAtMs: number;
    lastSeenAtMs: number;
    isBuffering: boolean;
}

export interface WatchPartyRoomState {
    code: string;
    hostProfileId: number;
    viewerRole?: WatchPartyRole;
    viewerProfileId?: number;
    currentEpisode: {
        seriesKey: string;
        episodeKey: string;
    };
    controlMode: WatchPartyControlMode;
    anchor: WatchPartyAnchor;
    bufferingWait?: WatchPartyBufferingWait | null;
    lastAction?: WatchPartyLastAction | null;
    participants: WatchPartyMember[];
    serverNowMs: number;
    expiresAtMs: number;
    closedAtMs: number | null;
    messages?: WatchPartyMessage[];
}

export interface WatchPartyLastAction {
    profileId: number;
    kind: "play" | "pause" | "seek" | "episode-change" | "control-mode";
    atMs: number;
}

export interface WatchPartyMessage {
    id: number;
    profileId: number;
    body: string;
    createdAtMs: number;
    authorName?: string;
    authorAvatar?: string | null;
    attachmentUrl?: string | null;
    attachmentKind?: "image" | "gif" | null;
}

export type WatchPartyCommand =
    | { kind: "play" }
    | { kind: "pause" }
    | { kind: "seek"; positionSeconds: number }
    | { kind: "episode-change"; episodeKey: string };

export type WatchPartyCommandRejection =
    | "closed"
    | "not-controller"
    | "stale-version"
    | "unknown-episode";

export interface JikanAnime {
    mal_id: number;
    title: string;
    title_english: string | null;
    synopsis: string | null;
    images: {
        jpg: {
            image_url: string;
        };
        webp: {
            large_image_url: string;
        };
    };
    trailer: {
        images: {
            maximum_image_url: string | null;
        } | null;
    } | null;
    rating: string | null;
    year: number | null;
    score: number | null;
    type: string | null;
    genres: JikanNamedEntry[] | null;
    studios: JikanNamedEntry[] | null;
}

export interface JikanNamedEntry {
    mal_id: number;
    name: string;
}

export interface JikanAnimeListResponse {
    data: JikanAnime[];
}

export interface JikanAnimeResponse {
    data: JikanAnime;
}

export interface JikanEpisode {
    mal_id: number;
    title: string | null;
    url: string;
}

export interface JikanEpisodesResponse {
    data: JikanEpisode[];
    pagination: {
        has_next_page: boolean;
    };
}

const valid = <T>(data: T): ContractResult<T> => ({ ok: true, data });
const invalid = <T>(name: string): ContractResult<T> => ({
    ok: false,
    error: `Invalid ${name} response`,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isNonNegativeInteger = (value: unknown): value is number =>
    isNumber(value) && Number.isInteger(value) && value >= 0;
const isNullableString = (value: unknown): value is string | null =>
    value === null || isString(value);
const isNullableNumber = (value: unknown): value is number | null =>
    value === null || isNumber(value);

const isMediaAssetStatus = (value: unknown): value is MediaAssetStatus =>
    value === "pending"
    || value === "processing"
    || value === "ready"
    || value === "failed"
    || value === "deleting"
    || value === "delete_failed"
    || value === "deleted";

const isEpisodeMediaStatus = (value: unknown): value is EpisodeMediaStatus =>
    isObject(value)
    && isNumber(value.assetId)
    && isNumber(value.assetVersion)
    && isMediaAssetStatus(value.status)
    && (value.delivery === "hls" || value.delivery === "file")
    && Array.isArray(value.heights)
    && value.heights.every(isNumber)
    && isNullableNumber(value.previewStartSeconds)
    && isBoolean(value.hasPreviewClip);

const isOptionalNullableEpisodeMedia = (value: unknown): value is EpisodeMediaStatus | null | undefined =>
    value === undefined || value === null || isEpisodeMediaStatus(value);

const isCatalogEpisode = (value: unknown): value is CatalogEpisodePayload =>
    isObject(value)
    && isString(value.key)
    && isNumber(value.number)
    && isNumber(value.sizeBytes)
    && isNumber(value.addedAt)
    && isOptionalNullableString(value.title)
    && isOptionalNullableString(value.synopsis)
    && isOptionalNullableNumber(value.durationSeconds)
    && isOptionalNullableString(value.thumbnail)
    && isOptionalNullableEpisodeMedia(value.media);

const isOptionalNullableString = (value: unknown): value is string | null | undefined =>
    value === undefined || isNullableString(value);
const isOptionalNullableNumber = (value: unknown): value is number | null | undefined =>
    value === undefined || isNullableNumber(value);
const isOptionalStringArray = (value: unknown): value is string[] | undefined =>
    value === undefined || (Array.isArray(value) && value.every(isString));
const isCatalogGenre = (value: unknown): value is CatalogGenre =>
    isObject(value) && isString(value.name) && isString(value.slug);
const isOptionalGenreArray = (value: unknown): value is CatalogGenre[] | undefined =>
    value === undefined || (Array.isArray(value) && value.every(isCatalogGenre));
const isOptionalBackdropSource = (value: unknown): value is "jikan" | "manual" | null | undefined =>
    value === undefined || value === null || value === "jikan" || value === "manual";
const isOptionalSeriesVisibility = (value: unknown): value is SeriesVisibility | undefined =>
    value === undefined
    || value === "public" || value === "restricted" || value === "admin" || value === "system";

const isCatalogSeries = (value: unknown): value is CatalogSeriesPayload =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.key)
    && isString(value.title)
    && isNumber(value.updatedAt)
    && isOptionalNullableNumber(value.groupId)
    && isOptionalNullableString(value.baseTitle)
    && isOptionalNullableNumber(value.seasonNumber)
    && isNullableString(value.coverImage)
    && isOptionalNullableString(value.posterImage)
    && isOptionalNullableString(value.backdropImage)
    && isOptionalBackdropSource(value.backdropSource)
    && isOptionalNullableString(value.logoImage)
    && isNullableString(value.synopsis)
    && isNullableString(value.rating)
    && isOptionalNullableString(value.ageRating)
    && isNullableNumber(value.year)
    && isOptionalNullableNumber(value.focalX)
    && isOptionalNullableNumber(value.focalY)
    && isOptionalNullableNumber(value.safeLeft)
    && isOptionalNullableNumber(value.safeBottom)
    && isOptionalNullableString(value.dominantColor)
    && isOptionalNullableString(value.placeholder)
    && isOptionalNullableString(value.posterDominantColor)
    && isOptionalNullableString(value.posterPlaceholder)
    && isOptionalNullableString(value.backdropDominantColor)
    && isOptionalNullableString(value.backdropPlaceholder)
    && isOptionalNullableString(value.studio)
    && isOptionalStringArray(value.audioLanguages)
    && isOptionalStringArray(value.subtitleLanguages)
    && isOptionalNullableString(value.metadataProvider)
    && isOptionalNullableNumber(value.externalId)
    && isOptionalNullableNumber(value.tmdbExternalId)
    && isOptionalGenreArray(value.genres)
    && isOptionalStringArray(value.altTitles)
    && isBoolean(value.hasMetadata)
    && isOptionalSeriesVisibility(value.visibility)
    && isNumber(value.episodeCount)
    && Array.isArray(value.episodes)
    && value.episodes.every(isCatalogEpisode);

const isResumePoint = (value: unknown): value is ResumePoint =>
    isObject(value)
    && isString(value.seriesKey)
    && isString(value.episodeKey)
    && isNumber(value.positionSeconds)
    && isNullableNumber(value.durationSeconds)
    && isNumber(value.updatedAt);

const isEpisodeProgress = (value: unknown): value is EpisodeProgress =>
    isObject(value)
    && isNumber(value.positionSeconds)
    && isNullableNumber(value.durationSeconds)
    && isBoolean(value.completed)
    && isNumber(value.updatedAt);

const isSeriesResumePoint = (value: unknown): value is SeriesResumePoint =>
    isObject(value)
    && isString(value.episodeKey)
    && isNumber(value.positionSeconds)
    && isNullableNumber(value.durationSeconds);

const isEpisodeProgressRecord = (value: unknown): value is Record<string, EpisodeProgress> =>
    isObject(value) && Object.values(value).every(isEpisodeProgress);

const isNullableTrailer = (value: unknown): value is JikanAnime["trailer"] => {
    if (value === null || value === undefined) return true;
    if (!isObject(value)) return false;
    if (value.images === null) return true;
    return isObject(value.images) && isNullableString(value.images.maximum_image_url);
};

const isNamedEntry = (value: unknown): value is JikanNamedEntry =>
    isObject(value) && isNumber(value.mal_id) && isString(value.name);

const isOptionalNamedEntryArray = (value: unknown): value is JikanNamedEntry[] | null | undefined =>
    value === undefined || value === null || (Array.isArray(value) && value.every(isNamedEntry));

const isJikanAnime = (value: unknown): value is JikanAnime =>
    isObject(value)
    && isNumber(value.mal_id)
    && isString(value.title)
    && isNullableString(value.title_english)
    && isNullableString(value.synopsis)
    && isObject(value.images)
    && isObject(value.images.jpg)
    && isString(value.images.jpg.image_url)
    && isObject(value.images.webp)
    && isString(value.images.webp.large_image_url)
    && isNullableTrailer(value.trailer)
    && isNullableString(value.rating)
    && isNullableNumber(value.year)
    && isNullableNumber(value.score)
    && isNullableString(value.type)
    && isOptionalNamedEntryArray(value.genres)
    && isOptionalNamedEntryArray(value.studios);

const isCatalogResponse = (value: unknown): value is CatalogResponse =>
    isObject(value)
    && isNumber(value.generatedAt)
    && Array.isArray(value.series)
    && value.series.every(isCatalogSeries);

const isContinueProgressResponse = (value: unknown): value is ContinueProgressResponse =>
    isObject(value)
    && Array.isArray(value.items)
    && value.items.every(isResumePoint);

const isSeriesProgressResponse = (value: unknown): value is SeriesProgressResponse =>
    isObject(value)
    && isString(value.seriesKey)
    && isEpisodeProgressRecord(value.episodes)
    && (value.resume === null || isSeriesResumePoint(value.resume));

const isEpisodeProgressResponse = (value: unknown): value is EpisodeProgressResponse =>
    isObject(value)
    && isNumber(value.positionSeconds)
    && isNullableNumber(value.durationSeconds)
    && isBoolean(value.completed);

const isSaveProgressResponse = (value: unknown): value is SaveProgressResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isBoolean(value.completed);

const isEpisodeChapter = (value: unknown): value is EpisodeChapter =>
    isObject(value)
    && isNonNegativeInteger(value.startSeconds)
    && isNonNegativeInteger(value.endSeconds)
    && value.startSeconds < value.endSeconds
    && (value.type === "intro" || value.type === "outro" || value.type === "recap");

const isEpisodeChaptersResponse = (value: unknown): value is EpisodeChapter[] =>
    Array.isArray(value) && value.every(isEpisodeChapter);

const isWatchlistItem = (value: unknown): value is WatchlistItem =>
    isObject(value)
    && isString(value.seriesKey)
    && isNumber(value.addedAt);

const isWatchlistResponse = (value: unknown): value is WatchlistResponse =>
    isObject(value)
    && isNumber(value.profileId)
    && Array.isArray(value.items)
    && value.items.every(isWatchlistItem);

const isToggleWatchlistResponse = (value: unknown): value is ToggleWatchlistResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isString(value.seriesKey);

const isCollectionSummary = (value: unknown): value is CollectionSummary =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isNumber(value.createdAt)
    && isNumber(value.itemCount);

const isCollectionsResponse = (value: unknown): value is CollectionsResponse =>
    isObject(value)
    && Array.isArray(value.collections)
    && value.collections.every(isCollectionSummary);

const isCollectionDetail = (value: unknown): value is CollectionDetail =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isNumber(value.createdAt)
    && Array.isArray(value.items)
    && value.items.every(isString);

const isCreateCollectionResponse = (value: unknown): value is CreateCollectionResponse =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isNumber(value.createdAt);

const isRenameCollectionResponse = (value: unknown): value is RenameCollectionResponse =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name);

const isDeleteCollectionResponse = (value: unknown): value is DeleteCollectionResponse =>
    isObject(value) && isBoolean(value.success);

const isAddCollectionItemResponse = (value: unknown): value is AddCollectionItemResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isString(value.seriesKey);

const isRemoveCollectionItemResponse = (value: unknown): value is RemoveCollectionItemResponse =>
    isObject(value) && isBoolean(value.success);

const isNotificationItem = (value: unknown): value is NotificationItem =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.seriesKey)
    && isString(value.episodeKey)
    && isNumber(value.createdAt);

const isNotificationsResponse = (value: unknown): value is NotificationsResponse =>
    isObject(value)
    && isNumber(value.count)
    && Array.isArray(value.items)
    && value.items.every(isNotificationItem);

const isMarkNotificationsReadResponse = (value: unknown): value is MarkNotificationsReadResponse =>
    isObject(value) && isBoolean(value.success);

const isRankingItem = (value: unknown): value is RankingItem =>
    isObject(value)
    && isString(value.seriesKey)
    && isNumber(value.playCount)
    && isNumber(value.rank);

const isRankingsResponse = (value: unknown): value is RankingsResponse =>
    isObject(value)
    && isString(value.period)
    && Array.isArray(value.items)
    && value.items.every(isRankingItem);

const isUploadTokenResponse = (value: unknown): value is UploadTokenResponse =>
    isObject(value)
    && isString(value.token)
    && isNumber(value.expiresAt)
    && isString(value.targetFolder)
    && isNumber(value.episodeNumber)
    && isString(value.fileName);

const isProfileSettings = (value: unknown): value is ProfileSettings =>
    isObject(value)
    && isBoolean(value.autoplayNext)
    && isBoolean(value.autoPreviewsEnabled)
    && isBoolean(value.skipIntroPrompt)
    && isNullableString(value.preferredSubtitleLang)
    && isNullableString(value.preferredAudioLang)
    && isNumber(value.defaultVolume)
    && isBoolean(value.reduceData);

const isSettingsResponse = (value: unknown): value is SettingsResponse =>
    isObject(value) && isNumber(value.profileId) && isProfileSettings(value.settings);

const isRequestEmailChangeResponse = (value: unknown): value is RequestEmailChangeResponse =>
    isObject(value) && isBoolean(value.success) && isString(value.message);

const isProfile = (value: unknown): value is Profile =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isBoolean(value.isDefault);

const isProfilesResponse = (value: unknown): value is ProfilesResponse =>
    isObject(value)
    && Array.isArray(value.profiles)
    && value.profiles.every(isProfile);

const isCreateProfileResponse = (value: unknown): value is CreateProfileResponse =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isBoolean(value.isDefault);

const isRenameProfileResponse = (value: unknown): value is RenameProfileResponse =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name);

const isDeleteProfileResponse = (value: unknown): value is DeleteProfileResponse =>
    isObject(value)
    && isBoolean(value.success);

const isJikanAnimeListResponse = (value: unknown): value is JikanAnimeListResponse =>
    isObject(value)
    && Array.isArray(value.data)
    && value.data.every(isJikanAnime);

const isJikanAnimeResponse = (value: unknown): value is JikanAnimeResponse =>
    isObject(value) && isJikanAnime(value.data);

const isJikanEpisode = (value: unknown): value is JikanEpisode =>
    isObject(value)
    && isNumber(value.mal_id)
    && isNullableString(value.title)
    && isString(value.url);

const isJikanEpisodesResponse = (value: unknown): value is JikanEpisodesResponse =>
    isObject(value)
    && Array.isArray(value.data)
    && value.data.every(isJikanEpisode)
    && isObject(value.pagination)
    && isBoolean(value.pagination.has_next_page);

const normalizeCatalogSeries = (series: CatalogSeriesPayload): CatalogSeriesPayload => ({
    ...series,
    groupId: series.groupId ?? null,
    baseTitle: series.baseTitle ?? null,
    seasonNumber: series.seasonNumber ?? null,
    posterImage: series.posterImage ?? null,
    backdropImage: series.backdropImage ?? null,
    backdropSource: series.backdropSource ?? null,
    logoImage: series.logoImage ?? null,
    ageRating: series.ageRating ?? null,
    focalX: series.focalX ?? null,
    focalY: series.focalY ?? null,
    safeLeft: series.safeLeft ?? null,
    safeBottom: series.safeBottom ?? null,
    dominantColor: series.dominantColor ?? null,
    placeholder: series.placeholder ?? null,
    posterDominantColor: series.posterDominantColor ?? null,
    posterPlaceholder: series.posterPlaceholder ?? null,
    backdropDominantColor: series.backdropDominantColor ?? null,
    backdropPlaceholder: series.backdropPlaceholder ?? null,
    studio: series.studio ?? null,
    audioLanguages: series.audioLanguages ?? [],
    subtitleLanguages: series.subtitleLanguages ?? [],
    metadataProvider: series.metadataProvider ?? null,
    externalId: series.externalId ?? null,
    tmdbExternalId: series.tmdbExternalId ?? null,
    genres: series.genres ?? [],
    altTitles: series.altTitles ?? [],
    visibility: series.visibility ?? "restricted",
    episodes: series.episodes.map((episode) => ({
        ...episode,
        title: episode.title ?? null,
        synopsis: episode.synopsis ?? null,
        durationSeconds: episode.durationSeconds ?? null,
        thumbnail: episode.thumbnail ?? null,
        media: episode.media ?? null,
    })),
});

export const validateCatalogResponse = (value: unknown): ContractResult<CatalogResponse> =>
    isCatalogResponse(value)
        ? valid({ ...value, series: value.series.map(normalizeCatalogSeries) })
        : invalid("catalog");

export const validateContinueProgressResponse = (value: unknown): ContractResult<ContinueProgressResponse> =>
    isContinueProgressResponse(value)
        ? valid(value)
        : invalid("continue progress");

export const validateSeriesProgressResponse = (value: unknown): ContractResult<SeriesProgressResponse> =>
    isSeriesProgressResponse(value)
        ? valid(value)
        : invalid("series progress");

export const validateEpisodeProgressResponse = (value: unknown): ContractResult<EpisodeProgressResponse> =>
    isEpisodeProgressResponse(value)
        ? valid(value)
        : invalid("episode progress");

export const validateSaveProgressResponse = (value: unknown): ContractResult<SaveProgressResponse> =>
    isSaveProgressResponse(value)
        ? valid(value)
        : invalid("save progress");

export const validateEpisodeChaptersResponse = (value: unknown): ContractResult<EpisodeChapter[]> =>
    isEpisodeChaptersResponse(value)
        ? valid(value)
        : invalid("episode chapters");

export const validateWatchlistResponse = (value: unknown): ContractResult<WatchlistResponse> =>
    isWatchlistResponse(value)
        ? valid(value)
        : invalid("watchlist");

export const validateToggleWatchlistResponse = (value: unknown): ContractResult<ToggleWatchlistResponse> =>
    isToggleWatchlistResponse(value)
        ? valid(value)
        : invalid("toggle watchlist");

export const validateCollectionsResponse = (value: unknown): ContractResult<CollectionsResponse> =>
    isCollectionsResponse(value)
        ? valid(value)
        : invalid("collections");

export const validateCollectionDetailResponse = (value: unknown): ContractResult<CollectionDetail> =>
    isCollectionDetail(value)
        ? valid(value)
        : invalid("collection detail");

export const validateCreateCollectionResponse = (value: unknown): ContractResult<CreateCollectionResponse> =>
    isCreateCollectionResponse(value)
        ? valid(value)
        : invalid("create collection");

export const validateRenameCollectionResponse = (value: unknown): ContractResult<RenameCollectionResponse> =>
    isRenameCollectionResponse(value)
        ? valid(value)
        : invalid("rename collection");

export const validateDeleteCollectionResponse = (value: unknown): ContractResult<DeleteCollectionResponse> =>
    isDeleteCollectionResponse(value)
        ? valid(value)
        : invalid("delete collection");

export const validateAddCollectionItemResponse = (value: unknown): ContractResult<AddCollectionItemResponse> =>
    isAddCollectionItemResponse(value)
        ? valid(value)
        : invalid("add collection item");

export const validateRemoveCollectionItemResponse = (value: unknown): ContractResult<RemoveCollectionItemResponse> =>
    isRemoveCollectionItemResponse(value)
        ? valid(value)
        : invalid("remove collection item");

export const validateNotificationsResponse = (value: unknown): ContractResult<NotificationsResponse> =>
    isNotificationsResponse(value)
        ? valid(value)
        : invalid("notifications");

export const validateMarkNotificationsReadResponse = (value: unknown): ContractResult<MarkNotificationsReadResponse> =>
    isMarkNotificationsReadResponse(value)
        ? valid(value)
        : invalid("mark notifications read");

export const validateRankingsResponse = (value: unknown): ContractResult<RankingsResponse> =>
    isRankingsResponse(value)
        ? valid(value)
        : invalid("rankings");

export const validateUploadTokenResponse = (value: unknown): ContractResult<UploadTokenResponse> =>
    isUploadTokenResponse(value)
        ? valid(value)
        : invalid("upload token");

export const validateProfilesResponse = (value: unknown): ContractResult<ProfilesResponse> =>
    isProfilesResponse(value)
        ? valid(value)
        : invalid("profiles");

export const validateCreateProfileResponse = (value: unknown): ContractResult<CreateProfileResponse> =>
    isCreateProfileResponse(value)
        ? valid(value)
        : invalid("create profile");

export const validateRenameProfileResponse = (value: unknown): ContractResult<RenameProfileResponse> =>
    isRenameProfileResponse(value)
        ? valid(value)
        : invalid("rename profile");

export const validateDeleteProfileResponse = (value: unknown): ContractResult<DeleteProfileResponse> =>
    isDeleteProfileResponse(value)
        ? valid(value)
        : invalid("delete profile");

export const validateSettingsResponse = (value: unknown): ContractResult<SettingsResponse> =>
    isSettingsResponse(value)
        ? valid(value)
        : invalid("settings");

export const validateRequestEmailChangeResponse = (value: unknown): ContractResult<RequestEmailChangeResponse> =>
    isRequestEmailChangeResponse(value)
        ? valid(value)
        : invalid("request email change");

const isUserRole = (value: unknown): value is UserRole => value === "viewer" || value === "admin";

export const validateMeResponse = (value: unknown): ContractResult<MeResponse> => {
    if (!isObject(value) || !isObject(value.user)) return invalid("me");

    const rawId = value.user.id;
    const id = isNumber(rawId)
        ? rawId
        : isString(rawId) && /^\d+$/.test(rawId)
            ? Number(rawId)
            : null;

    if (
        id === null
        || !Number.isSafeInteger(id)
        || !isString(value.user.username)
        || !isString(value.user.email)
    ) {
        return invalid("me");
    }

    const rawOnboardedAt = value.user.onboardedAt;

    return valid({
        user: {
            id,
            username: value.user.username,
            email: value.user.email,
            role: isUserRole(value.user.role) ? value.user.role : "viewer",
            onboardedAt: isString(rawOnboardedAt) ? rawOnboardedAt : null,
        },
    });
};

export const validateJikanAnimeListResponse = (value: unknown): ContractResult<JikanAnimeListResponse> =>
    isJikanAnimeListResponse(value)
        ? valid(value)
        : invalid("Jikan anime list");

export const validateJikanAnimeResponse = (value: unknown): ContractResult<JikanAnimeResponse> =>
    isJikanAnimeResponse(value)
        ? valid(value)
        : invalid("Jikan anime");

export const validateJikanEpisodesResponse = (value: unknown): ContractResult<JikanEpisodesResponse> =>
    isJikanEpisodesResponse(value)
        ? valid(value)
        : invalid("Jikan episodes");

const isProviderId = (value: unknown): value is "anilist" | "tmdb" | "jikan" =>
    value === "anilist" || value === "tmdb" || value === "jikan";

const isSeriesCandidate = (value: unknown): value is SeriesCandidate =>
    isObject(value)
    && isProviderId(value.providerId)
    && isString(value.externalId)
    && isString(value.title)
    && Array.isArray(value.altTitles)
    && value.altTitles.every(isString)
    && isNullableNumber(value.year)
    && isNullableString(value.format)
    && isNullableString(value.coverImage);

export const validateSeriesCandidateList = (value: unknown): ContractResult<SeriesCandidate[]> =>
    Array.isArray(value) && value.every(isSeriesCandidate)
        ? valid(value)
        : invalid("series candidate list");

const isProviderSeriesTitles = (value: unknown): value is ProviderSeries["titles"] =>
    isObject(value)
    && isString(value.primary)
    && isNullableString(value.romaji)
    && isNullableString(value.english)
    && isNullableString(value.native);

const isProviderSeries = (value: unknown): value is ProviderSeries =>
    isObject(value)
    && isProviderId(value.providerId)
    && isString(value.externalId)
    && isNullableNumber(value.malId)
    && isProviderSeriesTitles(value.titles)
    && Array.isArray(value.synonyms)
    && value.synonyms.every(isString)
    && isNullableString(value.synopsis)
    && isNullableNumber(value.score)
    && isNullableString(value.ageRating)
    && isNullableNumber(value.year)
    && Array.isArray(value.genres)
    && value.genres.every(isString)
    && isNullableString(value.studio);

export const validateProviderSeries = (value: unknown): ContractResult<ProviderSeries> =>
    isProviderSeries(value)
        ? valid(value)
        : invalid("provider series");

const isProviderArtworkKind = (value: unknown): value is "poster" | "backdrop" | "logo" =>
    value === "poster" || value === "backdrop" || value === "logo";

const isProviderArtwork = (value: unknown): value is ProviderArtwork =>
    isObject(value)
    && isProviderArtworkKind(value.kind)
    && isString(value.url)
    && isNullableNumber(value.width)
    && isNullableNumber(value.height)
    && isNullableString(value.language);

export const validateProviderArtworkList = (value: unknown): ContractResult<ProviderArtwork[]> =>
    Array.isArray(value) && value.every(isProviderArtwork)
        ? valid(value)
        : invalid("provider artwork list");

export interface SeriesExternalIdResponse {
    success: boolean;
    seriesKey: string;
    provider: string;
    externalId: string;
}

export interface SeriesArtworkSyncResponse {
    success: boolean;
    seriesKey: string;
    count: number;
}

export interface SeriesTitlesSyncResponse {
    success: boolean;
    seriesKey: string;
    count: number;
}

const isSeriesExternalIdResponse = (value: unknown): value is SeriesExternalIdResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isString(value.seriesKey)
    && isString(value.provider)
    && isString(value.externalId);

const isSeriesArtworkSyncResponse = (value: unknown): value is SeriesArtworkSyncResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isString(value.seriesKey)
    && isNumber(value.count);

const isSeriesTitlesSyncResponse = (value: unknown): value is SeriesTitlesSyncResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isString(value.seriesKey)
    && isNumber(value.count);

export const validateSeriesExternalIdResponse = (value: unknown): ContractResult<SeriesExternalIdResponse> =>
    isSeriesExternalIdResponse(value)
        ? valid(value)
        : invalid("series external id response");

export const validateSeriesArtworkSyncResponse = (value: unknown): ContractResult<SeriesArtworkSyncResponse> =>
    isSeriesArtworkSyncResponse(value)
        ? valid(value)
        : invalid("series artwork sync response");

export const validateSeriesTitlesSyncResponse = (value: unknown): ContractResult<SeriesTitlesSyncResponse> =>
    isSeriesTitlesSyncResponse(value)
        ? valid(value)
        : invalid("series titles sync response");

export interface SeriesMetadataLookupResponse {
    seriesKey: string;
    externalIds: Record<string, string>;
    titles: { title: string; kind: string }[];
}

const isSeriesMetadataLookupResponse = (value: unknown): value is SeriesMetadataLookupResponse =>
    isObject(value)
    && isString(value.seriesKey)
    && isObject(value.externalIds)
    && Object.values(value.externalIds).every(isString)
    && Array.isArray(value.titles)
    && value.titles.every((entry) => isObject(entry) && isString(entry.title) && isString(entry.kind));

export const validateSeriesMetadataLookupResponse = (value: unknown): ContractResult<SeriesMetadataLookupResponse> =>
    isSeriesMetadataLookupResponse(value)
        ? valid(value)
        : invalid("series metadata lookup response");

export interface AniListTitle {
    romaji: string | null;
    english: string | null;
    native: string | null;
}

export interface AniListStudios {
    nodes: { name: string }[];
}

export interface AniListCoverImage {
    extraLarge: string | null;
    large: string | null;
    color: string | null;
}

export interface AniListMedia {
    id: number;
    idMal: number | null;
    title: AniListTitle;
    synonyms: string[];
    description: string | null;
    seasonYear: number | null;
    format: string | null;
    episodes: number | null;
    averageScore: number | null;
    genres: string[];
    studios: AniListStudios | null;
    coverImage: AniListCoverImage | null;
    bannerImage: string | null;
    isAdult: boolean;
}

export interface AniListError {
    message: string;
}

export interface AniListSearchResponse {
    data: { Page: { media: AniListMedia[] } } | null;
    errors?: AniListError[];
}

export interface AniListMediaResponse {
    data: { Media: AniListMedia } | null;
    errors?: AniListError[];
}

const isAniListTitle = (value: unknown): value is AniListTitle =>
    isObject(value)
    && isNullableString(value.romaji)
    && isNullableString(value.english)
    && isNullableString(value.native);

const isAniListStudios = (value: unknown): value is AniListStudios =>
    isObject(value)
    && Array.isArray(value.nodes)
    && value.nodes.every((node) => isObject(node) && isString(node.name));

const isAniListCoverImage = (value: unknown): value is AniListCoverImage =>
    isObject(value)
    && isNullableString(value.extraLarge)
    && isNullableString(value.large)
    && isNullableString(value.color);

const isAniListMedia = (value: unknown): value is AniListMedia =>
    isObject(value)
    && isNumber(value.id)
    && isNullableNumber(value.idMal)
    && isAniListTitle(value.title)
    && Array.isArray(value.synonyms)
    && value.synonyms.every(isString)
    && isNullableString(value.description)
    && isNullableNumber(value.seasonYear)
    && isNullableString(value.format)
    && isNullableNumber(value.episodes)
    && isNullableNumber(value.averageScore)
    && Array.isArray(value.genres)
    && value.genres.every(isString)
    && (value.studios === null || isAniListStudios(value.studios))
    && (value.coverImage === null || isAniListCoverImage(value.coverImage))
    && isNullableString(value.bannerImage)
    && isBoolean(value.isAdult);

const isAniListErrorArray = (value: unknown): value is AniListError[] =>
    Array.isArray(value) && value.every((entry) => isObject(entry) && isString(entry.message));

const isAniListSearchResponse = (value: unknown): value is AniListSearchResponse =>
    isObject(value)
    && (value.errors === undefined || isAniListErrorArray(value.errors))
    && !(Array.isArray(value.errors) && value.errors.length > 0)
    && value.data !== null
    && isObject(value.data)
    && isObject(value.data.Page)
    && Array.isArray(value.data.Page.media)
    && value.data.Page.media.every(isAniListMedia);

const isAniListMediaResponse = (value: unknown): value is AniListMediaResponse =>
    isObject(value)
    && (value.errors === undefined || isAniListErrorArray(value.errors))
    && !(Array.isArray(value.errors) && value.errors.length > 0)
    && value.data !== null
    && isObject(value.data)
    && isAniListMedia(value.data.Media);

export const validateAniListSearchResponse = (value: unknown): ContractResult<AniListSearchResponse> =>
    isAniListSearchResponse(value)
        ? valid(value)
        : invalid("AniList search response");

export const validateAniListMediaResponse = (value: unknown): ContractResult<AniListMediaResponse> =>
    isAniListMediaResponse(value)
        ? valid(value)
        : invalid("AniList media response");

export interface TmdbConfigurationResponse {
    images: {
        secure_base_url: string;
        backdrop_sizes: string[];
        poster_sizes: string[];
        logo_sizes: string[];
    };
}

export interface TmdbGenre {
    id: number;
    name: string;
}

export interface TmdbProductionCompany {
    name: string;
}

export interface TmdbContentRating {
    iso_3166_1: string;
    rating: string;
}

export interface TmdbSeasonSummary {
    season_number: number;
    name: string;
}

export interface TmdbTvDetails {
    id: number;
    name: string;
    original_name: string;
    overview: string | null;
    first_air_date: string | null;
    genres: TmdbGenre[];
    production_companies: TmdbProductionCompany[];
    vote_average: number | null;
    content_ratings: { results: TmdbContentRating[] } | null;
    seasons: TmdbSeasonSummary[];
}

export interface TmdbImage {
    file_path: string;
    width: number;
    height: number;
    iso_639_1: string | null;
    vote_average: number;
}

export interface TmdbImagesResponse {
    id: number;
    backdrops: TmdbImage[];
    posters: TmdbImage[];
    logos: TmdbImage[];
}

export interface TmdbTvSearchResult {
    id: number;
    name: string;
    original_name: string;
    first_air_date: string | null;
    overview: string | null;
}

export interface TmdbTvSearchResponse {
    results: TmdbTvSearchResult[];
}

export interface TmdbTvListItem {
    id: number;
    name: string;
    popularity: number;
    vote_average: number;
    vote_count: number;
    first_air_date: string | null;
    genre_ids: number[];
}

export interface TmdbTvListResponse {
    page: number;
    results: TmdbTvListItem[];
    total_pages: number;
    total_results: number;
}

const isTmdbConfigurationResponse = (value: unknown): value is TmdbConfigurationResponse =>
    isObject(value)
    && isObject(value.images)
    && isString(value.images.secure_base_url)
    && Array.isArray(value.images.backdrop_sizes)
    && value.images.backdrop_sizes.every(isString)
    && Array.isArray(value.images.poster_sizes)
    && value.images.poster_sizes.every(isString)
    && Array.isArray(value.images.logo_sizes)
    && value.images.logo_sizes.every(isString);

const isTmdbGenre = (value: unknown): value is TmdbGenre =>
    isObject(value) && isNumber(value.id) && isString(value.name);

const isTmdbProductionCompany = (value: unknown): value is TmdbProductionCompany =>
    isObject(value) && isString(value.name);

const isTmdbContentRating = (value: unknown): value is TmdbContentRating =>
    isObject(value) && isString(value.iso_3166_1) && isString(value.rating);

const isTmdbContentRatings = (value: unknown): value is { results: TmdbContentRating[] } =>
    isObject(value) && Array.isArray(value.results) && value.results.every(isTmdbContentRating);

const isTmdbSeasonSummary = (value: unknown): value is TmdbSeasonSummary =>
    isObject(value) && isNumber(value.season_number) && isString(value.name);

const isTmdbTvDetails = (value: unknown): value is TmdbTvDetails =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isString(value.original_name)
    && isNullableString(value.overview)
    && isNullableString(value.first_air_date)
    && Array.isArray(value.genres)
    && value.genres.every(isTmdbGenre)
    && Array.isArray(value.production_companies)
    && value.production_companies.every(isTmdbProductionCompany)
    && isNullableNumber(value.vote_average)
    && (value.content_ratings === undefined || value.content_ratings === null || isTmdbContentRatings(value.content_ratings))
    && Array.isArray(value.seasons)
    && value.seasons.every(isTmdbSeasonSummary);

const isTmdbImage = (value: unknown): value is TmdbImage =>
    isObject(value)
    && isString(value.file_path)
    && isNumber(value.width)
    && isNumber(value.height)
    && isNullableString(value.iso_639_1)
    && isNumber(value.vote_average);

const isTmdbImagesResponse = (value: unknown): value is TmdbImagesResponse =>
    isObject(value)
    && isNumber(value.id)
    && Array.isArray(value.backdrops)
    && value.backdrops.every(isTmdbImage)
    && Array.isArray(value.posters)
    && value.posters.every(isTmdbImage)
    && Array.isArray(value.logos)
    && value.logos.every(isTmdbImage);

const isTmdbTvSearchResult = (value: unknown): value is TmdbTvSearchResult =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.name)
    && isString(value.original_name)
    && isNullableString(value.first_air_date)
    && isNullableString(value.overview);

const isTmdbTvSearchResponse = (value: unknown): value is TmdbTvSearchResponse =>
    isObject(value)
    && Array.isArray(value.results)
    && value.results.every(isTmdbTvSearchResult);

const isPositiveInteger = (value: unknown): value is number =>
    isNumber(value) && Number.isSafeInteger(value) && value > 0;

const isTmdbTvListItem = (value: unknown): value is TmdbTvListItem =>
    isObject(value)
    && isPositiveInteger(value.id)
    && isString(value.name)
    && isNumber(value.popularity)
    && value.popularity >= 0
    && isNumber(value.vote_average)
    && value.vote_average >= 0
    && value.vote_average <= 10
    && isNonNegativeInteger(value.vote_count)
    && isNullableString(value.first_air_date)
    && Array.isArray(value.genre_ids)
    && value.genre_ids.every(isPositiveInteger);

const isTmdbTvListResponse = (value: unknown): value is TmdbTvListResponse =>
    isObject(value)
    && isPositiveInteger(value.page)
    && Array.isArray(value.results)
    && value.results.every(isTmdbTvListItem)
    && isNonNegativeInteger(value.total_pages)
    && isNonNegativeInteger(value.total_results);

export const validateTmdbConfigurationResponse = (value: unknown): ContractResult<TmdbConfigurationResponse> =>
    isTmdbConfigurationResponse(value)
        ? valid(value)
        : invalid("TMDB configuration response");

export const validateTmdbTvDetails = (value: unknown): ContractResult<TmdbTvDetails> =>
    isTmdbTvDetails(value)
        ? valid(value)
        : invalid("TMDB tv details");

const isWatchPartyCommand = (value: unknown): value is WatchPartyCommand => {
    if (!isObject(value)) return false;

    switch (value.kind) {
        case "play":
        case "pause":
            return true;
        case "seek":
            return isNumber(value.positionSeconds) && value.positionSeconds >= 0;
        case "episode-change":
            return isString(value.episodeKey) && value.episodeKey.length > 0;
        default:
            return false;
    }
};

export const validateWatchPartyCommand = (value: unknown): ContractResult<WatchPartyCommand> =>
    isWatchPartyCommand(value)
        ? valid(value)
        : invalid("watch party command");

export const validateTmdbImagesResponse = (value: unknown): ContractResult<TmdbImagesResponse> =>
    isTmdbImagesResponse(value)
        ? valid(value)
        : invalid("TMDB images response");

export const validateTmdbTvSearchResponse = (value: unknown): ContractResult<TmdbTvSearchResponse> =>
    isTmdbTvSearchResponse(value)
        ? valid(value)
        : invalid("TMDB tv search response");

export const validateTmdbTvListResponse = (value: unknown): ContractResult<TmdbTvListResponse> =>
    isTmdbTvListResponse(value)
        ? valid(value)
        : invalid("TMDB tv list response");

export interface TmdbSeasonEpisode {
    episode_number: number;
    name: string | null;
    overview: string | null;
    still_path: string | null;
}

export interface TmdbSeasonResponse {
    episodes: TmdbSeasonEpisode[];
}

const isTmdbSeasonEpisode = (value: unknown): value is TmdbSeasonEpisode =>
    isObject(value)
    && isNumber(value.episode_number)
    && isNullableString(value.name)
    && isNullableString(value.overview)
    && isNullableString(value.still_path);

const isTmdbSeasonResponse = (value: unknown): value is TmdbSeasonResponse =>
    isObject(value)
    && Array.isArray(value.episodes)
    && value.episodes.every(isTmdbSeasonEpisode);

export const validateTmdbSeasonResponse = (value: unknown): ContractResult<TmdbSeasonResponse> =>
    isTmdbSeasonResponse(value)
        ? valid(value)
        : invalid("TMDB season response");

export interface AdminLibraryEpisode {
    episodeKey: string;
    sizeBytes: number;
    title: string | null;
    durationSeconds: number | null;
}

export interface AdminLibrarySeries {
    seriesKey: string;
    episodeCount: number;
    totalBytes: number;
    visibility: SeriesVisibility;
    episodes: AdminLibraryEpisode[];
}

export interface AdminLibraryResponse {
    series: AdminLibrarySeries[];
}

const isAdminLibraryEpisode = (value: unknown): value is AdminLibraryEpisode =>
    isObject(value)
    && isString(value.episodeKey)
    && isNumber(value.sizeBytes)
    && isNullableString(value.title)
    && isNullableNumber(value.durationSeconds);

const isAdminLibrarySeries = (value: unknown): value is AdminLibrarySeries =>
    isObject(value)
    && isString(value.seriesKey)
    && isNumber(value.episodeCount)
    && isNumber(value.totalBytes)
    && isOptionalSeriesVisibility(value.visibility)
    && Array.isArray(value.episodes)
    && value.episodes.every(isAdminLibraryEpisode);

const isAdminLibraryResponse = (value: unknown): value is AdminLibraryResponse =>
    isObject(value) && Array.isArray(value.series) && value.series.every(isAdminLibrarySeries);

export const validateAdminLibraryResponse = (value: unknown): ContractResult<AdminLibraryResponse> =>
    isAdminLibraryResponse(value)
        ? valid(value)
        : invalid("admin library response");

export interface MediaStatusRendition {
    height: number;
    width: number | null;
    bitrateKbps: number;
    playlistKey: string;
    segmentCount: number | null;
    sizeBytes: number | null;
}

export interface MediaStatusAsset {
    seriesKey: string;
    episodeKey: string;
    status: string;
    delivery: "hls" | "file";
    durationSeconds: number | null;
    totalSizeBytes: number | null;
    previewClipKey: string | null;
    errorMessage: string | null;
    updatedAt: string;
    renditions: MediaStatusRendition[];
}

export interface MediaStatusLastVerification {
    ranAt: string;
    checkedCount: number;
    failedCount: number;
}

export interface MediaStatusResponse {
    assets: MediaStatusAsset[];
    lastVerification: MediaStatusLastVerification | null;
}

const isMediaStatusRendition = (value: unknown): value is MediaStatusRendition =>
    isObject(value)
    && isNumber(value.height)
    && isNullableNumber(value.width)
    && isNumber(value.bitrateKbps)
    && isString(value.playlistKey)
    && isNullableNumber(value.segmentCount)
    && isNullableNumber(value.sizeBytes);

const isMediaStatusAsset = (value: unknown): value is MediaStatusAsset =>
    isObject(value)
    && isString(value.seriesKey)
    && isString(value.episodeKey)
    && isString(value.status)
    && (value.delivery === "hls" || value.delivery === "file")
    && isNullableNumber(value.durationSeconds)
    && isNullableNumber(value.totalSizeBytes)
    && isNullableString(value.previewClipKey)
    && isNullableString(value.errorMessage)
    && isString(value.updatedAt)
    && Array.isArray(value.renditions)
    && value.renditions.every(isMediaStatusRendition);

const isMediaStatusLastVerification = (value: unknown): value is MediaStatusLastVerification =>
    isObject(value)
    && isString(value.ranAt)
    && isNumber(value.checkedCount)
    && isNumber(value.failedCount);

const isMediaStatusResponse = (value: unknown): value is MediaStatusResponse =>
    isObject(value)
    && Array.isArray(value.assets)
    && value.assets.every(isMediaStatusAsset)
    && (value.lastVerification === null || isMediaStatusLastVerification(value.lastVerification));

export const validateMediaStatusResponse = (value: unknown): ContractResult<MediaStatusResponse> =>
    isMediaStatusResponse(value)
        ? valid(value)
        : invalid("media status response");

export interface StorageUsageSnapshot {
    date: string;
    totalBytes: number;
}

export interface StorageUsageResponse {
    currentTotalBytes: number;
    currentMonthAverageBytes: number;
    history: StorageUsageSnapshot[];
}

const isStorageUsageSnapshot = (value: unknown): value is StorageUsageSnapshot =>
    isObject(value) && isString(value.date) && isNumber(value.totalBytes);

const isStorageUsageResponse = (value: unknown): value is StorageUsageResponse =>
    isObject(value)
    && isNumber(value.currentTotalBytes)
    && isNumber(value.currentMonthAverageBytes)
    && Array.isArray(value.history)
    && value.history.every(isStorageUsageSnapshot);

export const validateStorageUsageResponse = (value: unknown): ContractResult<StorageUsageResponse> =>
    isStorageUsageResponse(value)
        ? valid(value)
        : invalid("storage usage response");

export interface AdminMediaDeleteResponse {
    success: boolean;
    deletedB2Objects: number;
}

const isAdminMediaDeleteResponse = (value: unknown): value is AdminMediaDeleteResponse =>
    isObject(value)
    && isBoolean(value.success)
    && isNumber(value.deletedB2Objects);

export const validateAdminMediaDeleteResponse = (value: unknown): ContractResult<AdminMediaDeleteResponse> =>
    isAdminMediaDeleteResponse(value)
        ? valid(value)
        : invalid("admin media delete response");

export interface AdminUserRow {
    id: number;
    username: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    createdAt: number;
}

export interface AdminUsersResponse {
    users: AdminUserRow[];
}

const isAdminUserRow = (value: unknown): value is AdminUserRow =>
    isObject(value)
    && isNumber(value.id)
    && isString(value.username)
    && isString(value.email)
    && isBoolean(value.emailVerified)
    && isUserRole(value.role)
    && isNumber(value.createdAt);

const isAdminUsersResponse = (value: unknown): value is AdminUsersResponse =>
    isObject(value) && Array.isArray(value.users) && value.users.every(isAdminUserRow);

export const validateAdminUsersResponse = (value: unknown): ContractResult<AdminUsersResponse> =>
    isAdminUsersResponse(value)
        ? valid(value)
        : invalid("admin users response");

export type ManagedSeriesVisibility = Exclude<SeriesVisibility, "system">;

export interface SeriesAccessGrantRow {
    seriesKey: string;
    userId: number;
    grantedAt: number;
}

export interface SeriesAccessOverviewResponse {
    users: AdminUserRow[];
    series: Array<{ seriesKey: string; visibility: SeriesVisibility }>;
    grants: SeriesAccessGrantRow[];
}

export const isManagedSeriesVisibility = (value: unknown): value is ManagedSeriesVisibility =>
    value === "public" || value === "restricted" || value === "admin";
