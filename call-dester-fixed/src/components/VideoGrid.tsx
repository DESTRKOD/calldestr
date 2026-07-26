import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Camera, CameraOff, Crown, FileText, User } from 'lucide-react';
import { Participant } from '../types';

interface VideoGridProps {
  participants: Participant[];
  currentUserId: string;
  controllerId: string;
  creatorId: string;
  streams: Map<string, MediaStream>;
  compactMode?: boolean; // When viewing a document, show as compact top bar
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  currentUserId,
  controllerId,
  creatorId,
  streams,
  compactMode = false,
}) => {
  if (compactMode) {
    // Bento Grid Sidebar column layout when viewing shared document
    return (
      <div className="w-full h-full flex flex-row lg:flex-col gap-3 lg:gap-4 overflow-x-auto lg:overflow-y-auto p-1">
        {participants.map((p) => {
          const isSelf = p.id === currentUserId;
          const stream = streams.get(p.id);
          const isController = p.id === controllerId;
          const isCreator = p.id === creatorId;

          return (
            <div
              key={p.id}
              className={`relative flex-shrink-0 lg:flex-shrink w-40 sm:w-48 lg:w-full h-28 lg:h-36 rounded-[28px] lg:rounded-[32px] overflow-hidden bg-white/10 backdrop-blur-xl border ${
                isSelf ? 'border-blue-400/50' : 'border-white/20'
              } shadow-xl flex items-center justify-center group transition-all`}
            >
              <VideoTileStream
                stream={stream}
                isSelf={isSelf}
                cameraOn={p.cameraOn}
                name={p.name}
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

              {/* Top Badges */}
              <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 z-10">
                {isCreator && (
                  <span className="p-1 rounded-full bg-amber-500/80 text-white backdrop-blur-md" title="Организатор">
                    <Crown className="w-3 h-3" />
                  </span>
                )}
                {isController && (
                  <span className="p-1 rounded-full bg-sky-500/80 text-white backdrop-blur-md" title="Управляет файлом">
                    <FileText className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Mic Icon */}
              <div className="absolute top-2.5 right-2.5 p-1 rounded-full bg-black/40 text-white backdrop-blur-md z-10">
                {p.micOn ? (
                  <Mic className="w-3 h-3 text-emerald-400" />
                ) : (
                  <MicOff className="w-3 h-3 text-rose-400" />
                )}
              </div>

              {/* Name Label */}
              <div className="absolute bottom-2.5 left-3 text-white text-xs font-medium z-10 truncate max-w-[85%]">
                {isSelf ? `${p.name} (Вы)` : p.name}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Full Screen Bento Grid View
  const count = participants.length;
  let gridColsClass = 'grid-cols-1';
  if (count === 2) {
    gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  } else if (count >= 3) {
    gridColsClass = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
  }

  return (
    <div className={`w-full h-full p-2 sm:p-4 grid ${gridColsClass} gap-4 max-w-6xl mx-auto items-center justify-center`}>
      {participants.map((p) => {
        const isSelf = p.id === currentUserId;
        const stream = streams.get(p.id);
        const isController = p.id === controllerId;
        const isCreator = p.id === creatorId;

        return (
          <div
            key={p.id}
            className={`relative w-full h-64 sm:h-80 md:h-96 rounded-[36px] overflow-hidden bg-white/10 backdrop-blur-2xl border ${
              isSelf ? 'border-blue-400/50' : 'border-white/20'
            } shadow-2xl flex items-center justify-center group transition-all duration-300`}
          >
            <VideoTileStream
              stream={stream}
              isSelf={isSelf}
              cameraOn={p.cameraOn}
              name={p.name}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

            {/* Top Badges */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
              {isCreator && (
                <div className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-amber-500/80 backdrop-blur-md text-white text-xs font-medium shadow-md">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Организатор</span>
                </div>
              )}
              {isController && (
                <div className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-sky-500/80 backdrop-blur-md text-white text-xs font-medium shadow-md">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Управляет просмотром</span>
                </div>
              )}
            </div>

            {/* Top Right Status (Mic) */}
            <div className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 z-10">
              {p.micOn ? (
                <Mic className="w-4 h-4 text-emerald-400" />
              ) : (
                <MicOff className="w-4 h-4 text-rose-400" />
              )}
            </div>

            {/* Bottom Left Name Tag */}
            <div className="absolute bottom-4 left-4 right-4 px-4 py-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-xs sm:text-sm font-medium text-white flex items-center justify-between z-10">
              <span className="truncate">
                {isSelf ? `${p.name} (Вы)` : p.name}
              </span>
              <span className="text-[10px] text-white/70 font-mono">
                {p.cameraOn ? 'WebRTC HD' : 'Камера выключена'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Sub-component for individual video element
interface VideoTileStreamProps {
  stream?: MediaStream;
  isSelf: boolean;
  cameraOn: boolean;
  name: string;
}

const VideoTileStream: React.FC<VideoTileStreamProps> = ({
  stream,
  isSelf,
  cameraOn,
  name,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [, setTrackStateTick] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const handleTrackChange = () => {
      setTrackStateTick((prev) => prev + 1);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true));
      }
    };

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);
    stream.getTracks().forEach((track) => {
      track.addEventListener('unmute', handleTrackChange);
      track.addEventListener('mute', handleTrackChange);
      track.addEventListener('ended', handleTrackChange);
    });

    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
      stream.getTracks().forEach((track) => {
        track.removeEventListener('unmute', handleTrackChange);
        track.removeEventListener('mute', handleTrackChange);
        track.removeEventListener('ended', handleTrackChange);
      });
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current
        .play()
        .then(() => setPlayBlocked(false))
        .catch((err) => {
          console.warn('Video/Audio autoplay blocked or warning:', err);
          if (!isSelf) setPlayBlocked(true);
        });
    }
  }, [stream, cameraOn, isSelf]);

  const handleUnblockPlay = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setPlayBlocked(false))
        .catch((e) => console.warn('Play retry failed:', e));
    }
  };

  const hasVideoTrack =
    cameraOn &&
    stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.enabled);

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div
      onClick={playBlocked ? handleUnblockPlay : undefined}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-900 ${
        playBlocked ? 'cursor-pointer' : ''
      }`}
    >
      {/* Video element - kept in DOM without display:none so audio plays even when camera is off */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // Only mute self to avoid acoustic echo
          className={`absolute inset-0 w-full h-full object-cover ${
            isSelf ? 'scale-x-[-1]' : ''
          } ${hasVideoTrack ? 'opacity-100 z-0' : 'opacity-0 -z-10 pointer-events-none'}`}
        />
      )}

      {/* Autoplay blocked overlay banner */}
      {playBlocked && !isSelf && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-amber-500/90 text-white text-[11px] font-medium rounded-full shadow-lg backdrop-blur-md flex items-center space-x-1 animate-pulse">
          <span>Нажмите, чтобы включить звук</span>
        </div>
      )}

      {/* Avatar sphere shown when camera is disabled or video track is unavailable */}
      {!hasVideoTrack && (
        <div className="relative z-10 flex flex-col items-center justify-center space-y-3 p-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-700 flex items-center justify-center text-2xl sm:text-3xl font-semibold text-white shadow-xl shadow-blue-500/20 border-2 border-white/20">
            {initial}
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-300 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
            <CameraOff className="w-3.5 h-3.5" />
            <span>{stream ? 'Камера выключена' : 'Подключение видео...'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
