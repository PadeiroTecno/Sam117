import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface StreamPlatform {
  id: string;
  name: string;
  enabled: boolean;
  rtmpUrl?: string;
  streamKey?: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
}

interface StreamData {
  isLive: boolean;
  streamUrl: string;
  title: string;
  viewers: number;
  uptime: string;
  bitrate: number;
  startTime?: Date;
  duration: number;
  platforms: StreamPlatform[];
  wowzaStatus: 'online' | 'offline' | 'error';
  applicationName: string;
  streamName: string;
  currentPlaylist?: {
    id: number;
    name: string;
    videos: any[];
    currentVideoIndex: number;
    isPlaying: boolean;
    loop: boolean;
    shuffle: boolean;
  };
  streamType: 'obs' | 'playlist' | 'none';
}

interface StreamContextType {
  streamData: StreamData;
  updateStreamData: (data: Partial<StreamData>) => void;
  startPlaylistStream: (playlistId: number, options?: { loop?: boolean; shuffle?: boolean }) => Promise<void>;
  stopStream: () => Promise<void>;
  refreshStreamStatus: () => Promise<void>;
  updatePlatformConfig: (platformId: string, config: Partial<StreamPlatform>) => void;
  connectToPlatform: (platformId: string) => Promise<void>;
  disconnectFromPlatform: (platformId: string) => Promise<void>;
  nextVideo: () => void;
  previousVideo: () => void;
  playVideo: (index: number) => void;
  togglePlayPause: () => void;
}

const StreamContext = createContext<StreamContextType | null>(null);

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};

interface StreamProviderProps {
  children: ReactNode;
}

const defaultPlatforms: StreamPlatform[] = [
  { id: 'youtube', name: 'YouTube', enabled: false, status: 'disconnected' },
  { id: 'instagram', name: 'Instagram', enabled: false, status: 'disconnected' },
  { id: 'facebook', name: 'Facebook', enabled: false, status: 'disconnected' },
  { id: 'twitch', name: 'Twitch', enabled: false, status: 'disconnected' },
  { id: 'vimeo', name: 'Vimeo', enabled: false, status: 'disconnected' },
  { id: 'tiktok', name: 'TikTok', enabled: false, status: 'disconnected' },
  { id: 'periscope', name: 'Periscope', enabled: false, status: 'disconnected' },
  { id: 'kwai', name: 'Kwai', enabled: false, status: 'disconnected' },
  { id: 'steam', name: 'Steam Valve', enabled: false, status: 'disconnected' },
  { id: 'rtmp', name: 'RTMP Próprio', enabled: false, status: 'disconnected' }
];

export const StreamProvider: React.FC<StreamProviderProps> = ({ children }) => {
  const { user, getToken } = useAuth();
  const [streamData, setStreamData] = useState<StreamData>({
    isLive: false,
    streamUrl: '',
    title: '',
    viewers: 0,
    uptime: '00:00:00',
    bitrate: 0,
    duration: 0,
    platforms: defaultPlatforms,
    wowzaStatus: 'offline',
    applicationName: 'live',
    streamName: '',
    streamType: 'none'
  });

  const updateStreamData = (data: Partial<StreamData>) => {
    setStreamData(prev => ({ ...prev, ...data }));
  };

  const updatePlatformConfig = (platformId: string, config: Partial<StreamPlatform>) => {
    setStreamData(prev => ({
      ...prev,
      platforms: prev.platforms.map(platform =>
        platform.id === platformId ? { ...platform, ...config } : platform
      )
    }));
  };

  const connectToPlatform = async (platformId: string) => {
    updatePlatformConfig(platformId, { status: 'connecting' });
    
    try {
      // Simular conexão com a plataforma
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updatePlatformConfig(platformId, { status: 'connected' });
    } catch (error) {
      updatePlatformConfig(platformId, { status: 'error' });
      throw error;
    }
  };

  const disconnectFromPlatform = async (platformId: string) => {
    try {
      // Simular desconexão da plataforma
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updatePlatformConfig(platformId, { status: 'disconnected' });
    } catch (error) {
      updatePlatformConfig(platformId, { status: 'error' });
      throw error;
    }
  };

  const startPlaylistStream = async (playlistId: number, options: { loop?: boolean; shuffle?: boolean } = {}) => {
    try {
      const token = await getToken();
      
      // Carregar dados da playlist
      const playlistResponse = await fetch(`/api/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!playlistResponse.ok) {
        throw new Error('Playlist não encontrada');
      }
      
      const playlist = await playlistResponse.json();
      
      // Carregar vídeos da playlist
      const videosResponse = await fetch(`/api/playlists/${playlistId}/videos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!videosResponse.ok) {
        throw new Error('Erro ao carregar vídeos da playlist');
      }
      
      const playlistVideos = await videosResponse.json();
      const videos = playlistVideos.map((item: any) => item.videos);
      
      if (videos.length === 0) {
        throw new Error('Playlist não possui vídeos');
      }
      
      // Embaralhar vídeos se solicitado
      let finalVideos = [...videos];
      if (options.shuffle) {
        finalVideos = finalVideos.sort(() => Math.random() - 0.5);
      }
      
      // Iniciar stream interno
      const response = await fetch('/api/streaming/start-internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          titulo: playlist.nome,
          videos: finalVideos,
          options: {
            loop: options.loop ?? true,
            shuffle: options.shuffle ?? false
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        updateStreamData({
          isLive: true,
          streamUrl: result.stream_url || '',
          streamName: result.stream_name || '',
          title: playlist.nome,
          startTime: new Date(),
          viewers: 0,
          bitrate: 2500,
          wowzaStatus: 'online',
          streamType: 'playlist',
          currentPlaylist: {
            id: playlistId,
            name: playlist.nome,
            videos: finalVideos,
            currentVideoIndex: 0,
            isPlaying: true,
            loop: options.loop ?? true,
            shuffle: options.shuffle ?? false
          }
        });
      } else {
        throw new Error(result.error || 'Erro ao iniciar playlist');
      }
    } catch (error) {
      console.error('Erro ao iniciar playlist:', error);
      throw error;
    }
  };

  const stopStream = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/stop-internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stream_type: streamData.streamType
        })
      });

      const result = await response.json();

      if (result.success) {
        updateStreamData({
          isLive: false,
          streamUrl: '',
          viewers: 0,
          uptime: '00:00:00',
          bitrate: 0,
          duration: 0,
          startTime: undefined,
          wowzaStatus: 'offline',
          streamName: '',
          streamType: 'none',
          currentPlaylist: undefined
        });
      } else {
        throw new Error(result.error || 'Erro ao parar transmissão');
      }
    } catch (error) {
      console.error('Erro ao parar stream:', error);
      throw error;
    }
  };

  const refreshStreamStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success && result.is_live && result.transmission) {
        const transmission = result.transmission;
        updateStreamData({
          isLive: true,
          viewers: transmission.stats.viewers,
          bitrate: transmission.stats.bitrate,
          uptime: transmission.stats.uptime,
          title: transmission.titulo,
          wowzaStatus: 'online'
        });
      } else {
        updateStreamData({
          isLive: false,
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00',
          wowzaStatus: 'offline'
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar status da transmissão:', error);
      updateStreamData({ wowzaStatus: 'error' });
    }
  };

  const nextVideo = () => {
    if (!streamData.currentPlaylist) return;
    
    const { videos, currentVideoIndex, loop } = streamData.currentPlaylist;
    let nextIndex = currentVideoIndex + 1;
    
    if (nextIndex >= videos.length) {
      if (loop) {
        nextIndex = 0;
      } else {
        // Parar playlist se não está em loop
        stopStream();
        return;
      }
    }
    
    updateStreamData({
      currentPlaylist: {
        ...streamData.currentPlaylist,
        currentVideoIndex: nextIndex
      }
    });
  };

  const previousVideo = () => {
    if (!streamData.currentPlaylist) return;
    
    const { videos, currentVideoIndex } = streamData.currentPlaylist;
    let prevIndex = currentVideoIndex - 1;
    
    if (prevIndex < 0) {
      prevIndex = videos.length - 1;
    }
    
    updateStreamData({
      currentPlaylist: {
        ...streamData.currentPlaylist,
        currentVideoIndex: prevIndex
      }
    });
  };

  const playVideo = (index: number) => {
    if (!streamData.currentPlaylist) return;
    
    const { videos } = streamData.currentPlaylist;
    if (index >= 0 && index < videos.length) {
      updateStreamData({
        currentPlaylist: {
          ...streamData.currentPlaylist,
          currentVideoIndex: index
        }
      });
    }
  };

  const togglePlayPause = () => {
    if (!streamData.currentPlaylist) return;
    
    updateStreamData({
      currentPlaylist: {
        ...streamData.currentPlaylist,
        isPlaying: !streamData.currentPlaylist.isPlaying
      }
    });
  };

  // Atualizar uptime e duração quando a transmissão estiver ativa
  useEffect(() => {
    if (!streamData.isLive || !streamData.startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - streamData.startTime!.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      const uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      const duration = Math.floor(diff / 1000);
      
      updateStreamData({ uptime, duration });
    }, 1000);

    return () => clearInterval(interval);
  }, [streamData.isLive, streamData.startTime]);

  // Atualizar dados da transmissão periodicamente
  useEffect(() => {
    if (!streamData.isLive) return;

    const interval = setInterval(refreshStreamStatus, 10000); // A cada 10 segundos

    return () => clearInterval(interval);
  }, [streamData.isLive]);

  // Verificar status inicial
  useEffect(() => {
    refreshStreamStatus();
  }, []);

  return (
    <StreamContext.Provider value={{
      streamData,
      updateStreamData,
      startPlaylistStream,
      stopStream,
      refreshStreamStatus,
      updatePlatformConfig,
      connectToPlatform,
      disconnectFromPlatform,
      nextVideo,
      previousVideo,
      playVideo,
      togglePlayPause
    }}>
      {children}
    </StreamContext.Provider>
  );
};