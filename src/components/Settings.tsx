import { useStore } from '../store';
import { 
  Settings as SettingsIcon, 
  Database, 
  Info, 
  Trash2, 
  Bell, 
  BellRing, 
  History, 
  Check, 
  X, 
  Download, 
  Zap, 
  Palette,
  Image as ImageIcon,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { deleteDownloadedEpisode } from '../services/downloader';
import { useState, useEffect, ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

const ACCENT_COLORS = [
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Violeta', value: '#8b5cf6' },
];

interface SectionProps {
  title: string;
  children: ReactNode;
}

const Section = ({ title, children }: SectionProps) => (
  <section>
    <h2 className="text-xs font-bold uppercase text-zinc-500 mb-3 px-1">{title}</h2>
    <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-white/5">
      {children}
    </div>
  </section>
);

interface SettingItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

const SettingItem = ({ icon, title, subtitle, children, active, onClick }: SettingItemProps) => (
  <div 
    className={clsx(
      "flex items-center justify-between p-4 transition-colors",
      onClick ? "cursor-pointer hover:bg-zinc-800" : ""
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div className={clsx(
        "p-2 rounded-lg transition-colors",
        active ? "bg-accent/10 text-accent" : "bg-zinc-800 text-zinc-500"
      )}>
        {icon}
      </div>
      <div>
        <span className="font-semibold block text-zinc-100 text-sm">{title}</span>
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
      </div>
    </div>
    {children}
  </div>
);

const Divider = () => <div className="h-px bg-white/5 mx-4" />;

export function Settings() {
  const { 
    downloads, 
    subscriptions, 
    history, 
    clearSubscriptions, 
    clearDownloads, 
    clearHistory,
    settings,
    updateSettings,
    accentColor,
    setAccentColor
  } = useStore();
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [confirming, setConfirming] = useState<'downloads' | 'subscriptions' | 'history' | 'images' | 'reset' | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const totalDownloadSize = downloads.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const formattedSize = (totalDownloadSize / (1024 * 1024)).toFixed(1);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleClearDownloads = async () => {
    for (const download of downloads) {
      await deleteDownloadedEpisode(download.id, download.audioUrl);
    }
    await clearDownloads();
    setConfirming(null);
    showMessage('Downloads removidos');
  };

  const handleClearSubscriptions = async () => {
    await clearSubscriptions();
    setConfirming(null);
    showMessage('Inscrições removidas');
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setConfirming(null);
    showMessage('Histórico limpo');
  };

  const handleClearImageCache = async () => {
    try {
      await caches.delete('podcast-image-cache-v1');
      setConfirming(null);
      showMessage('Cache de imagens limpo');
    } catch (e) {
      showMessage('Falha ao limpar cache de imagens', 'error');
    }
  };

  const handleResetAll = async () => {
    try {
      await handleClearDownloads();
      await clearSubscriptions();
      await clearHistory();
      await updateSettings({ autoDownload: false, autoDelete: false });
      setAccentColor('#8b5cf6');
      setConfirming(null);
      showMessage('Todas as configurações foram resetadas');
    } catch (e) {
      showMessage('Erro ao resetar configurações', 'error');
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showMessage('Este navegador não suporta notificações.', 'error');
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
      navigator.serviceWorker.getRegistration().then(reg => {
        const options = {
          body: 'Um novo episódio do seu podcast favorito acabou de sair!',
          icon: 'https://images.icon-icons.com/2642/PNG/512/google_podcast_logo_icon_159336.png',
          badge: 'https://images.icon-icons.com/2642/PNG/512/google_podcast_logo_icon_159336.png',
          vibrate: [100, 50, 100],
        };
        
        if (reg && reg.showNotification) {
          reg.showNotification('Novo Episódio Disponível!', options);
        } else {
          new Notification('Novo Episódio Disponível!', options);
        }
      });
    } else {
      showMessage('Por favor, ative as notificações primeiro.', 'error');
    }
  };

  const Toggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
    <button 
      onClick={onToggle}
      className={clsx(
        "w-10 h-5 rounded-full transition-all relative",
        enabled ? "bg-accent" : "bg-zinc-800"
      )}
    >
      <div 
        className={clsx(
          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
          enabled ? "left-6" : "left-1"
        )}
      />
    </button>
  );

  return (
    <div className="p-4 pb-32 min-h-screen bg-zinc-950">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-1">Personalize sua experiência</p>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={clsx(
              "fixed top-6 left-6 right-6 z-[60] p-4 rounded-xl shadow-xl flex items-center gap-3 border backdrop-blur-lg",
              message.type === 'success' 
                ? "bg-zinc-900 border-emerald-500/20 text-emerald-400" 
                : "bg-zinc-900 border-red-500/20 text-red-400"
            )}
          >
            {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-medium">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Appearance Section */}
        <Section title="Aparência">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Palette size={20} />
              </div>
              <div>
                <span className="font-semibold block text-zinc-100 text-sm">Cor de Destaque</span>
                <span className="text-xs text-zinc-500">Escolha a cor principal do app</span>
              </div>
            </div>
            
            <div className="grid grid-cols-6 gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={clsx(
                    "aspect-square rounded-full transition-all relative flex items-center justify-center border-2",
                    accentColor === color.value ? "border-white" : "border-transparent"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {accentColor === color.value && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Intelligent Management Section */}
        <Section title="Gerenciamento Inteligente">
          <SettingItem 
            icon={<Download size={20} />}
            title="Auto-download"
            subtitle="Baixar novos episódios automaticamente"
            active={settings.autoDownload}
          >
            <Toggle 
              enabled={settings.autoDownload} 
              onToggle={() => updateSettings({ autoDownload: !settings.autoDownload })} 
            />
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<Zap size={20} />}
            title="Auto-delete"
            subtitle="Apagar episódios ouvidos após 24h"
            active={settings.autoDelete}
          >
            <Toggle 
              enabled={settings.autoDelete} 
              onToggle={() => updateSettings({ autoDelete: !settings.autoDelete })} 
            />
          </SettingItem>
        </Section>

        {/* Notifications Section */}
        <Section title="Notificações">
          <SettingItem 
            icon={<Bell size={20} />}
            title="Novos Episódios"
            subtitle="Avisar quando houver novidades"
            active={notificationPermission === 'granted'}
          >
            <button 
              onClick={requestNotificationPermission}
              disabled={notificationPermission === 'granted'}
              className={clsx(
                "text-xs px-3 py-1.5 rounded-lg font-bold transition-all",
                notificationPermission === 'granted' 
                  ? "bg-accent/10 text-accent" 
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              )}
            >
              {notificationPermission === 'granted' ? 'ATIVADO' : 'ATIVAR'}
            </button>
          </SettingItem>
          {notificationPermission === 'granted' && (
            <>
              <Divider />
              <SettingItem 
                icon={<BellRing size={20} />}
                title="Testar Notificação"
                onClick={simulateNewEpisode}
              >
                <div />
              </SettingItem>
            </>
          )}
        </Section>

        {/* Storage Section */}
        <Section title="Armazenamento">
          <SettingItem 
            icon={<Database size={20} />}
            title="Áudio Baixado"
            subtitle={`${formattedSize} MB utilizados`}
            active={true}
          >
            {downloads.length > 0 && (
              confirming === 'downloads' ? (
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5">
                  <button onClick={handleClearDownloads} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                  <button onClick={() => setConfirming(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setConfirming('downloads')} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all">
                  <Trash2 size={20} />
                </button>
              )
            )}
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<ImageIcon size={20} />}
            title="Cache de Imagens"
            subtitle="Limpar capas salvas"
          >
            {confirming === 'images' ? (
              <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5">
                <button onClick={handleClearImageCache} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                <button onClick={() => setConfirming(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setConfirming('images')} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all">
                <Trash2 size={20} />
              </button>
            )}
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<SettingsIcon size={20} />}
            title="Inscrições"
            subtitle={`${subscriptions.length} podcasts na biblioteca`}
          >
            {subscriptions.length > 0 && (
              confirming === 'subscriptions' ? (
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5">
                  <button onClick={handleClearSubscriptions} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                  <button onClick={() => setConfirming(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setConfirming('subscriptions')} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all">
                  <Trash2 size={20} />
                </button>
              )
            )}
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<History size={20} />}
            title="Histórico"
            subtitle={`${history.length} episódios registrados`}
          >
            {history.length > 0 && (
              confirming === 'history' ? (
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-white/5">
                  <button onClick={handleClearHistory} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md"><Check size={16} /></button>
                  <button onClick={() => setConfirming(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-700 rounded-md"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setConfirming('history')} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-all">
                  <Trash2 size={20} />
                </button>
              )
            )}
          </SettingItem>
        </Section>

        {/* System Section */}
        <Section title="Sistema">
          <SettingItem 
            icon={<RotateCcw size={20} />}
            title="Resetar Tudo"
            subtitle="Volta o app para o estado inicial"
            onClick={() => setConfirming('reset')}
          >
            <div />
          </SettingItem>
        </Section>

        {/* About Section */}
        <Section title="Sobre">
          <SettingItem 
            icon={<Info size={20} />}
            title="Versão"
            subtitle="Podcast App Team"
          >
            <span className="text-zinc-500 font-bold text-xs bg-zinc-800 px-2 py-1 rounded-lg">1.2.0</span>
          </SettingItem>
        </Section>
      </div>

      {/* Confirmation Dialogs */}
      <AnimatePresence>
        {confirming && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-white/5"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 mb-2">Confirmar ação?</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  {confirming === 'subscriptions' && 'Isso removerá todas as suas inscrições permanentemente.'}
                  {confirming === 'downloads' && 'Todos os episódios baixados serão excluídos do dispositivo.'}
                  {confirming === 'history' && 'Seu histórico de reprodução será limpo.'}
                  {confirming === 'images' && 'O cache de imagens será limpo.'}
                  {confirming === 'reset' && 'Isso apagará TODOS os dados do aplicativo.'}
                </p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button 
                    onClick={() => setConfirming(null)}
                    className="py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-100 font-semibold text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirming === 'subscriptions') await handleClearSubscriptions();
                      if (confirming === 'downloads') await handleClearDownloads();
                      if (confirming === 'history') await handleClearHistory();
                      if (confirming === 'images') await handleClearImageCache();
                      if (confirming === 'reset') await handleResetAll();
                    }}
                    className="py-2.5 px-4 rounded-xl bg-red-500 text-white font-semibold text-sm"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
