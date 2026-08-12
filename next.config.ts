import type { NextConfig } from "next";

const b2Origin = (() => {
    const endpoint = process.env.B2_ENDPOINT?.trim();
    if (!endpoint) return "";
    try { return new URL(endpoint.startsWith("http") ? endpoint : `https://${endpoint}`).origin; } catch { return ""; }
})();

const partyStreamOrigin = (() => {
    const raw = process.env.PARTY_REALTIME_STREAM_ORIGIN?.trim();
    if (!raw) return "";
    try { return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin; } catch { return ""; }
})();

const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://cdn.myanimelist.net https://s4.anilist.co https://image.tmdb.org${b2Origin ? ` ${b2Origin}` : ""}`,
    `media-src 'self' blob:${b2Origin ? ` ${b2Origin}` : ""}`,
    `connect-src 'self' blob:${b2Origin ? ` ${b2Origin}` : ""}${partyStreamOrigin ? ` ${partyStreamOrigin}` : ""}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    headers: async () => [{ source: "/:path*", headers: securityHeaders }],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.myanimelist.net',
            },
            {
                protocol: 'https',
                hostname: 's4.anilist.co',
            },
            {
                protocol: 'https',
                hostname: 'image.tmdb.org',
                pathname: '/t/p/**',
            },
        ],
    },
};

export default nextConfig;
