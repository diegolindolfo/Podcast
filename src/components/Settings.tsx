import { useStore } from '../store';
import { Settings as SettingsIcon, Database, Info, Moon, Trash2, Bell, BellRing, History, Check, X, Download, Zap } from 'lucide-react';
import { deleteDownloadedEpisode } from '../services/downloader';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

import { motion } from 'motion/react';

export function Settings() {
  const { 
    downloads, 
    subscriptions, 
    history, 
    clearSubscriptions, 
    clearDownloads, 
    clearHistory,
    settings,
    updateSettings
  } = useStore();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [confirming, setConfirming] = useState<'downloads' | 'subscriptions' | 'history' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const totalDownloadSize = downloads.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const formattedSize = (totalDownloadSize / (1024 * 1024)).toFixed(1);

  const handleClearDownloads = async () => {
    for (const download of downloads) {
      await deleteDownloadedEpisode(download.id, download.audioUrl);
    }
    await clearDownloads();
    setConfirming(null);
  };

  const handleClearSubscriptions = async () => {
    await clearSubscriptions();
    setConfirming(null);
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setConfirming(null);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setError('Este navegador não suporta notificações.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification('Notificações Ativadas!', {
        body: 'Você receberá avisos sobre novos episódios.',
        icon: 'https://images.icon-icons.com/2642/PNG/512/google_podcast_logo_icon_159336.png'
      });
    }
  };

  const simulateNewEpisode = () => {
    if (notificationPermission === 'granted') {
      // Try to use Service Worker registration for notifications if available
      navigator.serviceWorker.getRegistration().then(reg => {
        const options = {
          body: 'Um novo episódio do seu podcast favorito acabou de sair!',
          icon: 'https://images.icon-icons.com/2642/PNG/512/google_podcast_logo_icon_159336.png',
          badge: 'https://images.icon-icons.com/2642/PNG/512/google_podcast_logo_icon_159336.png',
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
          }
        };
        
        if (reg && reg.showNotification) {
          reg.showNotification('Novo Episódio Disponível!', options);
        } else {
          new Notification('Novo Episódio Disponível!', options);
        }
      });
    } else {
      setError('Por favor, ative as notificações primeiro.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const Toggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
    <button 
      onClick={onToggle}
      className={clsx(
        "w-11 h-6 rounded-full transition-all relative",
        enabled ? "bg-accent shadow-[0_0_10px_rgba(var(--color-accent),0.3)]" : "bg-zinc-800"
      )}
    >
      <motion.div 
        animate={{ x: enabled ? 20 : 2 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  );

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-1">Personalize sua experiência</p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-8">
        {/* Intelligent Downloads Section */}
        <section>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">Gerenciamento Inteligente</h2>
          <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="flex items-center justify-between p-5 hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("p-2.5 rounded-xl", settings.autoDownload ? "bg-accent/10 text-accent" : "bg-zinc-800 text-zinc-500")}>
                  <Download size={20} />
                </div>
                <div>
                  <span className="font-bold block text-zinc-100">Auto-download</span>
                  <span className="text-xs text-zinc-500 font-medium">Baixar novos episódios automaticamente</span>
                </div>
              </div>
              <Toggle 
                enabled={settings.autoDownload} 
                onToggle={() => updateSettings({ autoDownload: !settings.autoDownload })} 
              />
            </div>
            <div className="h-px bg-white/5 mx-5" />
            <div className="flex items-center justify-between p-5 hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className={clsx("p-2.5 rounded-xl", settings.autoDelete ? "bg-accent/10 text-accent" : "bg-zinc-800 text-zinc-500")}>
                  <Zap size={20} />
                </div>
                <div>
                  <span className="font-bold block text-zinc-100">Auto-delete</span>
                  <span className="text-xs text-zinc-500 font-medium">Apagar episódios ouvidos após 24h</span>
                </div>
              </div>
              <Toggle 
                enabled={settings.autoDelete} 
                onToggle={() => updateSettings({ autoDelete: !settings.autoDelete })} 
              />
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">Notificações</h2>
          <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className={clsx("p-2.5 rounded-xl", notificationPermission === 'granted' ? "bg-accent/10 text-accent" : "bg-zinc-800 text-zinc-500")}>
                  <Bell size={20} />
                </div>
                <div>
                  <span className="font-bold block text-zinc-100">Novos Episódios</span>
                  <span className="text-xs text-zinc-500 font-medium">Avisar quando houver novidades</span>
                </div>
              </div>
              <button 
                onClick={requestNotificationPermission}
                disabled={notificationPermission === 'granted'}
                className={clsx(
                  "text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-lg",
                  notificationPermission === 'granted' 
                    ? "bg-accent/20 text-accent border border-accent/20" 
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/5"
                )}
              >
                {notificationPermission === 'granted' ? 'ATIVADO' : 'ATIVAR'}
              </button>
            </div>
            {notificationPermission === 'granted' && (
              <>
                <div className="h-px bg-white/5 mx-5" />
                <button 
                  className="flex items-center justify-between p-5 w-full hover:bg-zinc-900/80 transition-colors text-left"
                  onClick={simulateNewEpisode}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
                      <BellRing size={20} />
                    </div>
                    <span className="font-bold text-zinc-300">Testar Notificação</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Storage Section */}
        <section>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">Armazenamento</h2>
          <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                  <Database size={20} />
                </div>
                <span className="font-bold text-zinc-100">Áudio Baixado</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-bold text-xs bg-zinc-800 px-2 py-1 rounded-lg">{formattedSize} MB</span>
                {downloads.length > 0 && (
                  confirming === 'downloads' ? (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1 border border-white/10 shadow-xl">
                      <button onClick={handleClearDownloads} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><Check size={18} /></button>
                      <button onClick={() => setConfirming(null)} className="p-2 text-zinc-500 hover:bg-zinc-700 rounded-lg"><X size={18} /></button>
                    </motion.div>
                  ) : (
                    <button onClick={() => setConfirming('downloads')} className="text-red-400 hover:bg-red-400/10 p-2.5 rounded-xl transition-all">
                      <Trash2 size={20} />
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="h-px bg-white/5 mx-5" />
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-500">
                  <SettingsIcon size={20} />
                </div>
                <span className="font-bold text-zinc-100">Inscrições</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-bold text-xs bg-zinc-800 px-2 py-1 rounded-lg">{subscriptions.length}</span>
                {subscriptions.length > 0 && (
                  confirming === 'subscriptions' ? (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1 border border-white/10 shadow-xl">
                      <button onClick={handleClearSubscriptions} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><Check size={18} /></button>
                      <button onClick={() => setConfirming(null)} className="p-2 text-zinc-500 hover:bg-zinc-700 rounded-lg"><X size={18} /></button>
                    </motion.div>
                  ) : (
                    <button onClick={() => setConfirming('subscriptions')} className="text-red-400 hover:bg-red-400/10 p-2.5 rounded-xl transition-all">
                      <Trash2 size={20} />
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="h-px bg-white/5 mx-5" />
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-500">
                  <History size={20} />
                </div>
                <span className="font-bold text-zinc-100">Histórico</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-bold text-xs bg-zinc-800 px-2 py-1 rounded-lg">{history.length}</span>
                {history.length > 0 && (
                  confirming === 'history' ? (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1 border border-white/10 shadow-xl">
                      <button onClick={handleClearHistory} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><Check size={18} /></button>
                      <button onClick={() => setConfirming(null)} className="p-2 text-zinc-500 hover:bg-zinc-700 rounded-lg"><X size={18} /></button>
                    </motion.div>
                  ) : (
                    <button onClick={() => setConfirming('history')} className="text-red-400 hover:bg-red-400/10 p-2.5 rounded-xl transition-all">
                      <Trash2 size={20} />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">Aparência</h2>
          <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-500">
                  <Moon size={20} />
                </div>
                <span className="font-bold text-zinc-100">Tema</span>
              </div>
              <span className="text-zinc-500 font-bold text-xs bg-zinc-800 px-3 py-1.5 rounded-xl">ESCURO</span>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">Sobre</h2>
          <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-500">
                  <Info size={20} />
                </div>
                <span className="font-bold text-zinc-100">Versão</span>
              </div>
              <span className="text-zinc-500 font-bold text-xs bg-zinc-800 px-3 py-1.5 rounded-xl">1.0.0</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
