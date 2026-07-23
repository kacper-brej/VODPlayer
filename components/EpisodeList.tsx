import EpisodeCard, {EpisodeProps} from "@/components/EpisodeCard";

interface EpisodeListProps {
    episodes: Omit<EpisodeProps, 'episodeId'>[];
    seriesId: string | number;
}

const EpisodeList = ({ episodes, seriesId }: EpisodeListProps) => {
    return (
        <div className='flex flex-col gap-2 md:gap-2 w-full max-w-5xl mx-auto px-4 md:px-8 pb-12'>
            {episodes.map((episode: EpisodeProps) => (
                <EpisodeCard
                    key={episode.id}
                    {...episode as EpisodeProps}
                    seriesId={seriesId}
                />
            ))}
        </div>
    )
}
export default EpisodeList;