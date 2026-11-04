import { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Loader2, ChevronLeft, X } from 'lucide-react';
import { Podcast } from '../types';
import { searchPodcasts, getTopPodcasts } from '../services/api';
import { clsx } from 'clsx';

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

export function Search({ onSelectPodcast }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);

  const trimmedQuery = query.trim();

  const runSearch = useCallback(async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (term.length < 2) return;
    setSelectedCategory(null);
    setLoading(true);
    setError(null);
    try {
      const data = await searchPodcasts(term);
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível concluir a busca. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const term = query.trim();

    if (term.length === 0) {
      setError(null);
      if (!selectedCategory) {
        setResults([]);
        setLoading(false);
      }
      return;
    }

    if (term.length < 2) {
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSelectedCategory(null);
      setLoading(true);
      setError(null);
      try {
        const data = await searchPodcasts(term);
        if (active) setResults(data);
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Não foi possível concluir a busca. Verifique sua conexão e tente novamente.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [query, selectedCategory]);

  useEffect(() => {
    if (!selectedCategory) return;
    let active = true;
    const fetchCategory = async () => {
      setLoading(true);
      setError(null);
      setResults([]);
      try {
        const data = await getTopPodcasts(selectedCategory.id);
        if (active) setResults(data);
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Não foi possível carregar a categoria. Tente novamente.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCategory();
    return () => { active = false; };
  }, [selectedCategory]);

  const handleCategoryClick = (cat: typeof CATEGORIES[0]) => {
    setQuery('');
    setError(null);
    setSelectedCategory({ id: cat.id, name: cat.name });
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setError(null);
    setResults([]);
  };

  const clearQuery = () => {
    setQuery('');
    setError(null);
    if (!selectedCategory) {
      setResults([]);
    }
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-bg-main">
      <div className="sticky top-0 z-10 bg-bg-main/80 backdrop-blur-md pt-safe pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-4 text-text-main">Descobrir</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmedQuery.length >= 1) {
              runSearch(trimmedQuery);
            }
          }}
          className="relative group"
        >
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={20} />
          <input
            type="search"
            placeholder="Buscar podcasts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-bg-surface border border-border-subtle rounded-xl py-4 pl-12 pr-12 text-text-main placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-main transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1 transition-colors"
              title="Limpar busca"
            >
              <X size={18} />
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center mt-24 gap-4">
          <Loader2 className="animate-spin text-accent-main" size={32} />
          <p className="text-text-muted text-sm">Buscando podcasts...</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center mt-20 text-center px-4 gap-3">
          <p className="text-red-400 font-medium text-sm">{error}</p>
          <button
            onClick={() => selectedCategory ? setSelectedCategory({ ...selectedCategory }) : runSearch(trimmedQuery)}
            className="px-4 py-2 rounded-xl bg-accent-main text-accent-text text-xs font-bold uppercase tracking-wider"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && trimmedQuery.length === 0 && !selectedCategory && (
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
        {results.map((podcast, index) => (
          <button
            key={podcast.collectionId}
            onClick={() => onSelectPodcast(podcast)}
            className="text-left group flex flex-col bg-bg-surface rounded-xl p-3 border border-white/5 transition-all duration-300 hover:bg-bg-surface-hover shadow-lg"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-bg-surface mb-3 shadow-md">
              <img
                src={podcast.artworkUrl600}
                alt={podcast.collectionName}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {selectedCategory && (
                <div className="absolute top-3 left-3 bg-bg-main/80 backdrop-blur-md text-text-main text-[10px] font-black px-2 py-1 rounded-lg border border-white/5">
                  #{index + 1}
                </div>
              )}
            </div>
            <h3 className="font-bold text-sm line-clamp-1 leading-tight group-hover:text-accent-main transition-colors text-text-main px-1">
              {podcast.collectionName}
            </h3>
            <p className="text-[10px] font-bold text-text-muted truncate mt-1 px-1 uppercase tracking-wider">{podcast.artistName}</p>
          </button>
        ))}
      </div>
      
      {!loading && !error && trimmedQuery.length >= 2 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-24 text-center px-4">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-text-muted font-medium">Nenhum podcast encontrado para "{trimmedQuery}"</p>
          <p className="text-text-muted text-sm mt-1 opacity-70">Tente buscar por outro termo ou categoria.</p>
        </div>
      )}
    </div>
  );
}
