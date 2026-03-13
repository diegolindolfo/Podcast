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
    <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4 px-2">{title}</h2>
    <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-xl">
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
      "flex items-center justify-between p-5 transition-colors",
      onClick ? "cursor-pointer hover:bg-zinc-900/80" : ""
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-4">
      <div className={clsx(
        "p-2.5 rounded-xl transition-colors",
        active ? "bg-accent/10 text-accent" : "bg-zinc-800 text-zinc-500"
      )}>
        {icon}
      </div>
      <div>
        <span className="font-bold block text-zinc-100">{title}</span>
        {subtitle && <span className="text-xs text-zinc-500 font-medium">{subtitle}</span>}
      </div>
    </div>
    {children}
  </div>
);

const Divider = () => <div className="h-px bg-white/5 mx-5" />;

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
      setAccentColor('#10b981');
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
            exit={{ opacity: 0, scale: 0.95 }}
            className={clsx(
              "fixed top-6 left-6 right-6 z-[60] p-4 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl",
              message.type === 'success' 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-medium">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8 max-w-2xl mx-auto">
        {/* Appearance Section */}
        <Section title="Aparência">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                <Palette size={20} />
              </div>
              <div>
                <span className="font-bold block text-zinc-100">Cor de Destaque</span>
                <span className="text-xs text-zinc-500 font-medium">Escolha a cor principal do app</span>
              </div>
            </div>
            
            <div className="grid grid-cols-6 gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={clsx(
                    "aspect-square rounded-full transition-all relative flex items-center justify-center border-2",
                    accentColor === color.value ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {accentColor === color.value && <Check size={16} className="text-white drop-shadow-md" />}
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
                "text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-lg",
                notificationPermission === 'granted' 
                  ? "bg-accent/20 text-accent border border-accent/20" 
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/5"
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
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<ImageIcon size={20} />}
            title="Cache de Imagens"
            subtitle="Limpar capas salvas"
          >
            {confirming === 'images' ? (
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1 border border-white/10 shadow-xl">
                <button onClick={handleClearImageCache} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><Check size={18} /></button>
                <button onClick={() => setConfirming(null)} className="p-2 text-zinc-500 hover:bg-zinc-700 rounded-lg"><X size={18} /></button>
              </motion.div>
            ) : (
              <button onClick={() => setConfirming('images')} className="text-red-400 hover:bg-red-400/10 p-2.5 rounded-xl transition-all">
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
          </SettingItem>
          <Divider />
          <SettingItem 
            icon={<History size={20} />}
            title="Histórico"
            subtitle={`${history.length} episódios registrados`}
          >
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
            <span className="text-zinc-500 font-bold text-xs bg-zinc-800 px-3 py-1.5 rounded-xl">1.2.0</span>
          </SettingItem>
        </Section>
      </div>

      {/* Confirmation Dialogs */}
      <AnimatePresence>
        {confirming && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-white/10"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-zinc-100 mb-2">Você tem certeza?</h3>
                <p className="text-zinc-400 text-sm mb-8">
                  {confirming === 'subscriptions' && 'Isso removerá todas as suas inscrições permanentemente.'}
                  {confirming === 'downloads' && 'Todos os episódios baixados serão excluídos do dispositivo.'}
                  {confirming === 'history' && 'Seu histórico de reprodução será limpo.'}
                  {confirming === 'images' && 'O cache de imagens será limpo. As capas serão baixadas novamente quando necessário.'}
                  {confirming === 'reset' && 'Isso apagará TODOS os dados e configurações do aplicativo.'}
                </p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button 
                    onClick={() => setConfirming(null)}
                    className="py-3 px-4 rounded-xl bg-zinc-800 text-zinc-100 font-semibold hover:bg-zinc-700 transition-colors"
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
                    className="py-3 px-4 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
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
