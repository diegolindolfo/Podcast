import { useState, useEffect } from 'react';
import { Search as SearchIcon, Loader2, ChevronLeft } from 'lucide-react';
import { Podcast } from '../types';
import { searchPodcasts, getTopPodcasts } from '../services/api';
import { clsx } from 'clsx';

interface SearchProps {
  onSelectPodcast: (podcast: Podcast) => void;
}

const CATEGORIES = [
  { id: '', name: 'Top Brasil', icon: '🇧🇷', color: 'bg-amber-500' },
  { id: '1318', name: 'Tecnologia', icon: '💻', color: 'bg-blue-500' },
  { id: '1303', name: 'Comédia', icon: '😂', color: 'bg-purple-500' },
  { id: '1489', name: 'Notícias', icon: '📰', color: 'bg-red-500' },
  { id: '1488', name: 'True Crime', icon: '🕵️', color: 'bg-zinc-800' },
  { id: '1545', name: 'Esportes', icon: '⚽', color: 'bg-green-500' },
  { id: '1321', name: 'Negócios', icon: '💼', color: 'bg-accent' },
  { id: '1304', name: 'Educação', icon: '📚', color: 'bg-indigo-500' },
  { id: '1512', name: 'Saúde', icon: '💪', color: 'bg-rose-500' },
];

export function Search({ onSelectPodcast }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setSelectedCategory(null);
        setLoading(true);
        try {
          const data = await searchPodcasts(query);
          setResults(data);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      } else if (query.length === 0 && !selectedCategory) {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    if (selectedCategory) {
      const fetchCategory = async () => {
        setLoading(true);
        setResults([]);
        try {
          const data = await getTopPodcasts(selectedCategory.id);
          setResults(data);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };
      fetchCategory();
    }
  }, [selectedCategory]);

  const handleCategoryClick = (cat: typeof CATEGORIES[0]) => {
    setQuery('');
    setSelectedCategory({ id: cat.id, name: cat.name });
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setResults([]);
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md pt-safe pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Descobrir</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            placeholder="Buscar podcasts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center mt-12">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      )}

      {!loading && query.length === 0 && !selectedCategory && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Explorar Categorias</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryClick(cat)}
                className={clsx(
                  "flex items-center gap-3 p-4 rounded-xl text-left transition-transform hover:scale-105 active:scale-95",
                  cat.color
                )}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="font-semibold text-white shadow-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCategory && !loading && (
        <div className="mt-2 mb-4 flex items-center gap-2">
          <button 
            onClick={clearCategory}
            className="p-1 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">{selectedCategory.name} Podcasts</h2>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
        {results.map((podcast, index) => (
          <button
            key={podcast.collectionId}
            onClick={() => onSelectPodcast(podcast)}
            className="text-left group flex flex-col relative"
          >
            <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 mb-2">
              <img
                src={podcast.artworkUrl600}
                alt={podcast.collectionName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              
              {selectedCategory && (
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-md">
                  #{index + 1}
                </div>
              )}
            </div>
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors">
              {podcast.collectionName}
            </h3>
            <p className="text-xs text-zinc-500 truncate mt-1">{podcast.artistName}</p>
          </button>
        ))}
      </div>
      
      {!loading && query.length > 2 && results.length === 0 && (
        <div className="text-center text-zinc-500 mt-12">
          Nenhum podcast encontrado para "{query}"
        </div>
      )}
    </div>
  );
}
