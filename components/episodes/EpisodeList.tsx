import EpisodeCard, {EpisodeProps} from "@/components/episodes/EpisodeCard";

interface EpisodeListProps {
    episodes: Omit<EpisodeProps, 'episodeId'>[];
    seriesId: string | number;
}

const EpisodeList = ({ episodes, seriesId }: EpisodeListProps) => {
    return (
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 w-full max-w-6xl mx-auto px-4 md:px-8 pb-12'>
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
