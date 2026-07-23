"use client";

import { useRef, useState, useEffect } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider, MediaTimeUpdateEvent } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

interface VideoPlayerProps {
    src: string;
    title: string;
    posterUrl?: string;
    onNextEpisode?: () => void;
    onProgressUpdate?: (currentTime: number) => void;
    startTime?: number;
}

export const VideoPlayer = ({ src, title, posterUrl, onNextEpisode, onProgressUpdate, startTime = 0 }: VideoPlayerProps) => {
    const [isMounted, setIsMounted] = useState(false);
    const lastSavedTime = useRef<number>(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleTimeUpdate = (e: MediaTimeUpdateEvent) => {
        const currentTime = typeof e.detail === 'number' ? e.detail : 0;

        if (onProgressUpdate && Math.abs(currentTime - lastSavedTime.current) >= 3) {
            onProgressUpdate(currentTime);
            lastSavedTime.current = currentTime;
        }
    };

    if (!isMounted) {
        return (
            <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const videoSrcWithTime = startTime > 0 ? `${src}#t=${Math.floor(startTime)}` : src;

    return (
        <div className="w-full h-full relative bg-black">
            <MediaPlayer
                title={title}
                src={videoSrcWithTime}
                crossOrigin="anonymous"
                className="w-full h-full"
                onEnded={onNextEpisode}
                onTimeUpdate={handleTimeUpdate}
                playsInline
            >
                <MediaProvider />
                <DefaultVideoLayout
                    thumbnails={posterUrl}
                    icons={defaultLayoutIcons}
                />
            </MediaPlayer>
        </div>
    );
};