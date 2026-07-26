import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ArrowRight, X } from 'lucide-react';

interface NameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  actionType: 'create' | 'join';
}

export const NameModal: React.FC<NameModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  actionType,
}) => {
  const [name, setName] = useState(() => {
    return localStorage.getItem('dester_user_name') || '';
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || `Участник ${Math.floor(Math.random() * 899 + 100)}`;
    localStorage.setItem('dester_user_name', trimmed);
    onSubmit(trimmed);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md p-6 sm:p-8 rounded-[36px] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl text-white relative"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center border border-white/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-white">Ваше имя</h3>
              <p className="text-xs text-white/70">
                {actionType === 'create'
                  ? 'Введите имя для создания комнаты'
                  : 'Введите имя для подключения к звонку'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-2 ml-1">
                Как вас будут видеть участники
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя"
                maxLength={24}
                className="w-full px-4 py-3.5 rounded-2xl bg-black/20 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-base font-medium transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 rounded-full bg-white text-blue-600 hover:bg-blue-50 font-semibold text-base shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              <span>
                {actionType === 'create' ? 'Создать звонок' : 'Войти в звонок'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
