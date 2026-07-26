import React, { useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Paperclip,
  PhoneOff,
  Loader2,
  Share2,
} from 'lucide-react';

interface ControlsDockProps {
  micOn: boolean;
  cameraOn: boolean;
  hasSharedFile: boolean;
  isUploadingFile?: boolean;
  canTransferControl?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFileUpload: (file: File) => void;
  onTransferControlClick?: () => void;
  onLeaveCall: () => void;
}

export const ControlsDock: React.FC<ControlsDockProps> = ({
  micOn,
  cameraOn,
  hasSharedFile,
  isUploadingFile,
  canTransferControl,
  onToggleMic,
  onToggleCamera,
  onFileUpload,
  onTransferControlClick,
  onLeaveCall,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl flex items-center space-x-3 sm:space-x-4 transition-all duration-300">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,image/*,.ppt,.pptx"
        className="hidden"
      />

      {/* Mic Button */}
      <button
        onClick={onToggleMic}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
          micOn
            ? 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/40'
        }`}
        title={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      {/* Camera Button */}
      <button
        onClick={onToggleCamera}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
          cameraOn
            ? 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/40'
        }`}
        title={cameraOn ? 'Выключить камеру' : 'Включить камеру'}
      >
        {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      {/* Attach File Button - Available to everyone if no file is uploaded yet */}
      {!hasSharedFile && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingFile}
          className="w-12 h-12 rounded-full bg-white text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-xl relative"
          title="Прикрепить общий файл (PDF, изображения, презентации)"
        >
          {isUploadingFile ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Optional Transfer Control button in dock when file is open */}
      {hasSharedFile && canTransferControl && onTransferControlClick && (
        <button
          onClick={onTransferControlClick}
          className="w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg shadow-sky-900/40"
          title="Передать управление файлом"
        >
          <Share2 className="w-5 h-5" />
        </button>
      )}

      {/* Leave Call Button */}
      <button
        onClick={onLeaveCall}
        className="w-12 h-12 sm:w-14 sm:h-12 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg shadow-rose-900/40"
        title="Выйти из звонка"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
};
