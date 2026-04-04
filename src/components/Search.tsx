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
  { id: '', name: 'Top Brasil', icon: '🇧🇷', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1318', name: 'Tecnologia', icon: '💻', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1303', name: 'Comédia', icon: '😂', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1489', name: 'Notícias', icon: '📰', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1488', name: 'True Crime', icon: '🕵️', color: 'bg-bg-surface-hover border-border-subtle' },
  { id: '1545', name: 'Esportes', icon: '⚽', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1321', name: 'Negócios', icon: '💼', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1304', name: 'Educação', icon: '📚', color: 'bg-accent-main/20 border-accent-main/20' },
  { id: '1512', name: 'Saúde', icon: '💪', color: 'bg-accent-main/20 border-accent-main/20' },
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
    <div className="p-4 pb-24 min-h-screen bg-bg-main">
      <div className="sticky top-0 z-10 bg-bg-main/80 backdrop-blur-md pt-safe pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4 text-text-main">Descobrir</h1>
        <div className="relative group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            placeholder="Buscar podcasts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-bg-surface border border-border-subtle rounded-xl py-4 pl-12 pr-4 text-text-main placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-main transition-all"
          />
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center mt-24 gap-4">
          <Loader2 className="animate-spin text-accent-main" size={32} />
          <p className="text-text-muted text-sm">Buscando podcasts...</p>
        </div>
      )}

      {!loading && query.length === 0 && !selectedCategory && (
        <div className="mt-6 flex flex-col gap-8">
          <div>
            <h2 className="text-lg font-bold mb-4 px-1 text-text-main">Explorar Categorias</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat)}
                  className={clsx(
                    "flex flex-col gap-2 p-4 rounded-xl text-left transition-all border border-border-subtle",
                    cat.color
                  )}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-bold text-text-main text-base">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedCategory && !loading && (
        <div className="mt-2 mb-6 flex items-center gap-3">
          <button 
            onClick={clearCategory}
            className="p-2 rounded-full bg-bg-surface text-text-muted hover:text-text-main transition-all border border-border-subtle"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-text-main">{selectedCategory.name}</h2>
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest">Top Podcasts</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
        {results.map((podcast) => (
          <button
            key={podcast.collectionId}
            onClick={() => onSelectPodcast(podcast)}
            className="text-left group flex flex-col"
          >
            <div className="relative aspect-square rounded-xl overflow-hidden bg-bg-surface mb-2 border border-border-subtle">
              <img
                src={podcast.artworkUrl600}
                alt={podcast.collectionName}
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {selectedCategory && (
                <div className="absolute top-2 left-2 bg-bg-main/80 backdrop-blur-md text-text-main text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-border-subtle">
                  #{results.indexOf(podcast) + 1}
                </div>
              )}
            </div>
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-accent-main transition-colors text-text-main">
              {podcast.collectionName}
            </h3>
            <p className="text-xs text-text-muted truncate mt-1">{podcast.artistName}</p>
          </button>
        ))}
      </div>
      
      {!loading && query.length > 2 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-24 text-center px-4">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-text-muted font-medium">Nenhum podcast encontrado para "{query}"</p>
          <p className="text-text-muted text-sm mt-1 opacity-70">Tente buscar por outro termo ou categoria.</p>
        </div>
      )}
    </div>
  );
}
