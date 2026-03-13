import { useState, useEffect } from 'react';
import { Search as SearchIcon, Loader2, ChevronLeft } from 'lucide-react';
import { Podcast } from '../types';
import { searchPodcasts, getTopPodcasts } from '../services/api';
import { clsx } from 'clsx';
import { useStore } from '../store';

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
  { id: '1321', name: 'Negócios', icon: '💼', color: 'bg-fuchsia-500' },
  { id: '1304', name: 'Educação', icon: '📚', color: 'bg-indigo-500' },
  { id: '1512', name: 'Saúde', icon: '💪', color: 'bg-rose-500' },
];

import { motion } from 'motion/react';

export function Search({ onSelectPodcast }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{id: string, name: string} | null>(null);
  const { subscriptions } = useStore();

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
    <div className="p-4 pb-24 min-h-screen bg-zinc-950">
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md pt-safe pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-[var(--color-accent-gradient)]">Descobrir</h1>
        <div className="relative group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar podcasts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-zinc-900 transition-all shadow-inner"
          />
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center mt-24 gap-4">
          <Loader2 className="animate-spin text-accent" size={40} />
          <p className="text-zinc-500 font-medium animate-pulse">Buscando podcasts...</p>
        </div>
      )}

      {!loading && query.length === 0 && !selectedCategory && (
        <div className="mt-6 flex flex-col gap-8">
          <div>
            <h2 className="text-xl font-bold mb-4 px-1">Explorar Categorias</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {CATEGORIES.map((cat, index) => (
                <motion.button
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCategoryClick(cat)}
                  className={clsx(
                    "flex flex-col gap-3 p-5 rounded-2xl text-left transition-all shadow-lg border border-white/10",
                    cat.color
                  )}
                >
                  <span className="text-3xl drop-shadow-md">{cat.icon}</span>
                  <span className="font-bold text-white text-lg tracking-tight drop-shadow-sm">{cat.name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedCategory && !loading && (
        <div className="mt-2 mb-6 flex items-center gap-3">
          <button 
            onClick={clearCategory}
            className="p-2 rounded-full bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all border border-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{selectedCategory.name}</h2>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Top Podcasts</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-4">
        {results.map((podcast, index) => (
          <motion.button
            key={podcast.collectionId}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectPodcast(podcast)}
            className="text-left group flex flex-col relative"
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 mb-3 shadow-lg shadow-black/40 border border-white/5">
              <img
                src={podcast.artworkUrl600}
                alt={podcast.collectionName}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {selectedCategory && (
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg border border-white/10 shadow-xl">
                  #{index + 1}
                </div>
              )}
            </div>
            <h3 className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors">
              {podcast.collectionName}
            </h3>
            <p className="text-xs text-zinc-500 truncate mt-1.5 font-medium">{podcast.artistName}</p>
          </motion.button>
        ))}
      </div>
      
      {!loading && query.length > 2 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-24 text-center px-4">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-zinc-400 font-medium">Nenhum podcast encontrado para "{query}"</p>
          <p className="text-zinc-600 text-sm mt-1">Tente buscar por outro termo ou categoria.</p>
        </div>
      )}
    </div>
  );
}
