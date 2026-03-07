import { useStore } from '../store';
import { Podcast } from '../types';

interface HomeProps {
  onSelectPodcast: (podcast: Podcast) => void;
}

export function Home({ onSelectPodcast }: HomeProps) {
  const { subscriptions } = useStore();

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🎧</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Nenhuma Inscrição</h2>
          <p className="text-zinc-500 text-sm max-w-xs">
            Pesquise por seus podcasts favoritos e inscreva-se para vê-los aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {subscriptions.map((podcast) => (
            <button
              key={podcast.collectionId}
              onClick={() => onSelectPodcast(podcast)}
              className="text-left group flex flex-col"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 mb-2 shadow-lg shadow-black/40">
                <img
                  src={podcast.artworkUrl600}
                  alt={podcast.collectionName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors">
                {podcast.collectionName}
              </h3>
              <p className="text-xs text-zinc-500 truncate mt-1">{podcast.artistName}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
