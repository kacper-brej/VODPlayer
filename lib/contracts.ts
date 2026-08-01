export type ContractResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

export interface CatalogEpisodePayload {
    key: string;
    number: number;
    sizeBytes: number;
    addedAt: number;
    title: string | null;
    synopsis: string | null;
    durationSeconds: number | null;
    thumbnail: string | null;
}

export interface CatalogGenre {
    name: string;
    slug: string;
}

export interface CatalogSeriesPayload {
    id: number;
    key: string;
    title: string;
    updatedAt: number;
    groupId: number | null;
    baseTitle: string | null;
    seasonNumber: number | null;
    coverImage: string | null;
    backdropImage: string | null;
    backdropSource: "jikan" | "manual" | null;
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
    studio: string | null;
    audioLanguages: string[];
    subtitleLanguages: string[];
    metadataProvider: string | null;
    externalId: number | null;
    genres: CatalogGenre[];
    hasMetadata: boolean;
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
    profileId: number;
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
    profileId: number;
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
    profileId: number;
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
}

export interface ProfilesResponse {
    profiles: Profile[];
}

export interface CreateProfileResponse {
    id: number;
    name: string;
    isDefault: boolean;
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

export interface AuthUser {
    id: number;
    username: string;
    email: string;
}

export interface MeResponse {
    user: AuthUser;
}

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

const isCatalogEpisode = (value: unknown): value is CatalogEpisodePayload =>
    isObject(value)
    && isString(value.key)
    && isNumber(value.number)
    && isNumber(value.sizeBytes)
    && isNumber(value.addedAt)
    && isOptionalNullableString(value.title)
    && isOptionalNullableString(value.synopsis)
    && isOptionalNullableNumber(value.durationSeconds)
    && isOptionalNullableString(value.thumbnail);

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
    && isOptionalNullableString(value.backdropImage)
    && isOptionalBackdropSource(value.backdropSource)
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
    && isOptionalNullableString(value.studio)
    && isOptionalStringArray(value.audioLanguages)
    && isOptionalStringArray(value.subtitleLanguages)
    && isOptionalNullableString(value.metadataProvider)
    && isOptionalNullableNumber(value.externalId)
    && isOptionalGenreArray(value.genres)
    && isBoolean(value.hasMetadata)
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
    && isNumber(value.profileId)
    && Array.isArray(value.items)
    && value.items.every(isResumePoint);

const isSeriesProgressResponse = (value: unknown): value is SeriesProgressResponse =>
    isObject(value)
    && isNumber(value.profileId)
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
    && isNumber(value.profileId)
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
    backdropImage: series.backdropImage ?? null,
    backdropSource: series.backdropSource ?? null,
    ageRating: series.ageRating ?? null,
    focalX: series.focalX ?? null,
    focalY: series.focalY ?? null,
    safeLeft: series.safeLeft ?? null,
    safeBottom: series.safeBottom ?? null,
    dominantColor: series.dominantColor ?? null,
    placeholder: series.placeholder ?? null,
    studio: series.studio ?? null,
    audioLanguages: series.audioLanguages ?? [],
    subtitleLanguages: series.subtitleLanguages ?? [],
    metadataProvider: series.metadataProvider ?? null,
    externalId: series.externalId ?? null,
    genres: series.genres ?? [],
    episodes: series.episodes.map((episode) => ({
        ...episode,
        title: episode.title ?? null,
        synopsis: episode.synopsis ?? null,
        durationSeconds: episode.durationSeconds ?? null,
        thumbnail: episode.thumbnail ?? null,
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

    return valid({
        user: {
            id,
            username: value.user.username,
            email: value.user.email,
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
