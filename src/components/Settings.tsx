import { useStore } from '../store';
import { Settings as SettingsIcon, Database, Info, Moon, Trash2, Bell, BellRing } from 'lucide-react';
import { deleteDownloadedEpisode } from '../services/downloader';
import { useState, useEffect } from 'react';

export function Settings() {
  const { downloads, subscriptions, clearSubscriptions, clearDownloads } = useStore();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const totalDownloadSize = downloads.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const formattedSize = (totalDownloadSize / (1024 * 1024)).toFixed(1);

  const handleClearDownloads = async () => {
    if (confirm('Tem certeza que deseja apagar todos os downloads?')) {
      for (const download of downloads) {
        await deleteDownloadedEpisode(download.id, download.audioUrl);
      }
      await clearDownloads();
    }
  };

  const handleClearSubscriptions = async () => {
    if (confirm('Tem certeza que deseja remover todas as inscrições?')) {
      await clearSubscriptions();
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification('Notificações Ativadas!', {
        body: 'Você receberá avisos sobre novos episódios.',
        icon: '/icon.svg'
      });
    }
  };

  const simulateNewEpisode = () => {
    if (notificationPermission === 'granted') {
      // Try to use Service Worker registration for notifications if available
      navigator.serviceWorker.getRegistration().then(reg => {
        const options = {
          body: 'Um novo episódio do seu podcast favorito acabou de sair!',
          icon: '/icon.svg',
          badge: '/icon.svg',
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
      alert('Por favor, ative as notificações primeiro.');
    }
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      </div>

      <div className="space-y-6">
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
                  <button onClick={handleClearDownloads} className="text-red-400 hover:text-red-300 p-2 -m-2">
                    <Trash2 size={18} />
                  </button>
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
                  <button onClick={handleClearSubscriptions} className="text-red-400 hover:text-red-300 p-2 -m-2">
                    <Trash2 size={18} />
                  </button>
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
