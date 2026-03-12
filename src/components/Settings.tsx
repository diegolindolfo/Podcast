import { useStore } from '../store';
import { Settings as SettingsIcon, Database, Info, Moon, Trash2, Bell, BellRing, History, Check, X, Download, Zap } from 'lucide-react';
import { deleteDownloadedEpisode } from '../services/downloader';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

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
        "w-10 h-6 rounded-full transition-colors relative",
        enabled ? "bg-accent" : "bg-zinc-700"
      )}
    >
      <div className={clsx(
        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
        enabled ? "left-5" : "left-1"
      )} />
    </button>
  );

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Intelligent Downloads Section */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-4 px-2">Gerenciamento Inteligente</h2>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Download className={settings.autoDownload ? 'text-accent' : 'text-zinc-500'} size={20} />
                <div>
                  <span className="font-medium block">Auto-download</span>
                  <span className="text-[10px] text-zinc-500">Baixar novos episódios automaticamente</span>
                </div>
              </div>
              <Toggle 
                enabled={settings.autoDownload} 
                onToggle={() => updateSettings({ autoDownload: !settings.autoDownload })} 
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Zap className={settings.autoDelete ? 'text-accent' : 'text-zinc-500'} size={20} />
                <div>
                  <span className="font-medium block">Auto-delete</span>
                  <span className="text-[10px] text-zinc-500">Apagar episódios ouvidos após 24h</span>
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
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-4 px-2">Notificações</h2>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell className={notificationPermission === 'granted' ? 'text-accent' : 'text-zinc-500'} size={20} />
                <span className="font-medium">Novos Episódios</span>
              </div>
              <button 
                onClick={requestNotificationPermission}
                disabled={notificationPermission === 'granted'}
                className={`text-sm px-3 py-1.5 rounded-full font-medium ${
                  notificationPermission === 'granted' 
                    ? 'bg-accent/20 text-accent' 
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {notificationPermission === 'granted' ? 'Ativado' : 'Ativar'}
              </button>
            </div>
            {notificationPermission === 'granted' && (
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={simulateNewEpisode}
              >
                <div className="flex items-center gap-3">
                  <BellRing className="text-zinc-400" size={20} />
                  <span className="font-medium text-zinc-300">Testar Notificação</span>
                </div>
              </div>
            )}
          </div>
        </section>
        {/* Storage Section */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-4 px-2">Armazenamento</h2>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Database className="text-accent" size={20} />
                <span className="font-medium">Áudio Baixado</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-mono text-sm">{formattedSize} MB</span>
                {downloads.length > 0 && (
                  confirming === 'downloads' ? (
                    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5 animate-in fade-in zoom-in duration-200">
                      <button onClick={handleClearDownloads} className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                      <button onClick={() => setConfirming(null)} className="p-1 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirming('downloads')} className="text-red-400 hover:text-red-300 p-2 -m-2">
                      <Trash2 size={18} />
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <SettingsIcon className="text-zinc-500" size={20} />
                <span className="font-medium">Inscrições</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-mono text-sm">{subscriptions.length}</span>
                {subscriptions.length > 0 && (
                  confirming === 'subscriptions' ? (
                    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5 animate-in fade-in zoom-in duration-200">
                      <button onClick={handleClearSubscriptions} className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                      <button onClick={() => setConfirming(null)} className="p-1 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirming('subscriptions')} className="text-red-400 hover:text-red-300 p-2 -m-2">
                      <Trash2 size={18} />
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <History className="text-zinc-500" size={20} />
                <span className="font-medium">Histórico</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 font-mono text-sm">{history.length}</span>
                {history.length > 0 && (
                  confirming === 'history' ? (
                    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5 animate-in fade-in zoom-in duration-200">
                      <button onClick={handleClearHistory} className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                      <button onClick={() => setConfirming(null)} className="p-1 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirming('history')} className="text-red-400 hover:text-red-300 p-2 -m-2">
                      <Trash2 size={18} />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-4 px-2">Aparência</h2>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Moon className="text-zinc-500" size={20} />
                <span className="font-medium">Tema</span>
              </div>
              <span className="text-zinc-400 text-sm">Escuro (Padrão)</span>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-4 px-2">Sobre</h2>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Info className="text-zinc-500" size={20} />
                <span className="font-medium">Versão</span>
              </div>
              <span className="text-zinc-400 font-mono text-sm">1.0.0</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
