import React from 'react';
import { motion } from 'motion/react';
import { PhoneCall, Users, PlusCircle, ArrowRight } from 'lucide-react';
import { RoomState } from '../types';

interface MainScreenProps {
  roomState: RoomState;
  onCreateCall: () => void;
  onJoinCall: () => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  roomState,
  onCreateCall,
  onJoinCall,
}) => {
  const isFull = roomState.participants.length >= roomState.maxParticipants;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-xl mx-auto w-full select-none">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full p-8 sm:p-12 rounded-[40px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl flex flex-col items-center text-white relative overflow-hidden"
      >
        {/* Call Dester Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[32px] bg-white/20 backdrop-blur-md border border-white/30 p-0.5 shadow-xl mb-6 flex items-center justify-center">
          <div className="w-full h-full rounded-[30px] bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-inner">
            <PhoneCall className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2 font-sans">
          Call Dester
        </h2>

        {/* Subtitle / Status */}
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-white/90 mb-8">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              roomState.exists
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse'
                : 'bg-white/40'
            }`}
          />
          <span>
            {roomState.exists
              ? `Активный звонок: ${roomState.participants.length} из ${roomState.maxParticipants} участников`
              : 'Нет активных звонков'}
          </span>
        </div>

        {/* Action Buttons according to Room Logic */}
        <div className="w-full space-y-3">
          {!roomState.exists ? (
            /* Button 1: Create Call (only if room does not exist) */
            <button
              onClick={onCreateCall}
              className="w-full py-4 px-6 rounded-full bg-white text-blue-600 hover:bg-blue-50 font-semibold text-base shadow-xl flex items-center justify-center space-x-3 transition-all duration-200 active:scale-[0.98] group"
            >
              <PlusCircle className="w-5 h-5 transition-transform group-hover:rotate-90 text-blue-600" />
              <span>Создать звонок</span>
            </button>
          ) : (
            /* Button 2: Join Call (if room exists) */
            <button
              onClick={onJoinCall}
              disabled={isFull}
              className={`w-full py-4 px-6 rounded-full font-semibold text-base shadow-xl flex items-center justify-center space-x-3 transition-all duration-200 active:scale-[0.98] ${
                isFull
                  ? 'bg-white/20 text-white/40 cursor-not-allowed border border-white/10'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/30'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>
                {isFull
                  ? 'Комната заполнена (3/3)'
                  : 'Вступить в звонок'}
              </span>
              {!isFull && <ArrowRight className="w-4 h-4 ml-1" />}
            </button>
          )}
        </div>

        {/* Minimal info note */}
        {roomState.exists && (
          <div className="mt-8 pt-4 border-t border-white/15 w-full flex items-center justify-between text-xs text-white/70">
            <span>Максимум 3 участника</span>
            <span>Одна общая комната</span>
          </div>
        )}
      </motion.div>
    </div>
  );
};
