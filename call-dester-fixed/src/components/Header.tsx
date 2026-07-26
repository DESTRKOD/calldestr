import React from 'react';
import { Video, Users, Wifi } from 'lucide-react';
import { Participant } from '../types';

interface HeaderProps {
  roomExists: boolean;
  participants: Participant[];
  maxParticipants: number;
  currentUserId?: string;
  onLeave?: () => void;
  inCall?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  roomExists,
  participants,
  maxParticipants,
}) => {
  return (
    <header className="w-full max-w-[1400px] mx-auto px-4 py-3 sm:px-6 z-30">
      <div className="flex items-center justify-between px-6 py-3 rounded-[32px] bg-white/20 backdrop-blur-xl border border-white/30 shadow-lg text-white">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
          <span className="font-semibold text-lg tracking-tight text-white font-sans">
            Call Dester
          </span>
          <span className="hidden sm:inline-block w-[1px] h-4 bg-white/30"></span>
          <span className="hidden sm:inline-block text-white/80 text-sm font-medium">
            {roomExists
              ? `Комната • ${participants.length} / ${maxParticipants}`
              : 'Комната свободна'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Avatar badges stack */}
          {roomExists && participants.length > 0 ? (
            <div className="flex -space-x-3 items-center">
              {participants.map((p, idx) => (
                <div
                  key={p.id}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white/50 flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow-md ${
                    idx === 0
                      ? 'bg-blue-600'
                      : idx === 1
                      ? 'bg-indigo-600'
                      : 'bg-emerald-600'
                  }`}
                  title={p.name}
                >
                  {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-white/90">
              <Users className="w-3.5 h-3.5" />
              <span>Свободно (0/{maxParticipants})</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
