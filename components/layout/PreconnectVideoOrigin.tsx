"use client";
import ReactDOM from "react-dom";

const VIDEO_ORIGIN = process.env.NEXT_PUBLIC_VOD_ORIGIN ?? "https://vids.kacper-brej.pl";

const PreconnectVideoOrigin = () => {
    ReactDOM.preconnect(VIDEO_ORIGIN, { crossOrigin: "anonymous" });
    ReactDOM.prefetchDNS(VIDEO_ORIGIN);

    return null;
};

export default PreconnectVideoOrigin;
