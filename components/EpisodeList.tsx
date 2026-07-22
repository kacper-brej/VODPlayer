import EpisodeCard, {EpisodeProps} from "@/components/EpisodeCard";

interface EpisodeListProps {
    episodes: EpisodeProps[];
}

const EpisodeList = ({ episodes }: EpisodeListProps) => {
    return (
        <div className='flex flex-col gap-2 md:gap-2 w-full max-w-5xl mx-auto px-4 md:px-8 pb-12'>
            {episodes.map((episode: EpisodeProps) => (
                <EpisodeCard key={episode.id} {...episode}/>
            ))}
        </div>
    )
}
export default EpisodeList;