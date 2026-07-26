import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  Share2,
  Lock,
  Unlock,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { SharedFile, Participant } from '../types';

interface DocumentViewerProps {
  sharedFile: SharedFile;
  currentUserId: string;
  controllerId: string;
  creatorId: string;
  participants: Participant[];
  onPageChange: (newPage: number) => void;
  onRemoveFile: () => void;
  onTransferControl: (targetUserId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  sharedFile,
  currentUserId,
  controllerId,
  creatorId,
  participants,
  onPageChange,
  onRemoveFile,
  onTransferControl,
}) => {
  const [zoom, setZoom] = useState(1);
  const [showTransferMenu, setShowTransferMenu] = useState(false);

  const isController = currentUserId === controllerId;
  const isCreator = currentUserId === creatorId;
  const canControl = isController || isCreator;

  const controllerParticipant = participants.find((p) => p.id === controllerId);
  const controllerName = controllerParticipant
    ? controllerParticipant.id === currentUserId
      ? 'Вы'
      : controllerParticipant.name
    : 'Организатор';

  const currentPage = sharedFile.currentPage || 1;
  const totalPages = sharedFile.totalPages || 1;

  // Resolve current page image source
  let currentPageUrl = sharedFile.dataUrl;
  if (sharedFile.pagesDataUrls && sharedFile.pagesDataUrls.length >= currentPage) {
    currentPageUrl = sharedFile.pagesDataUrls[currentPage - 1];
  }

  const handlePrevPage = () => {
    if (canControl && currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (canControl && currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-between relative overflow-hidden bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] sm:rounded-[40px] shadow-2xl p-3 sm:p-5 text-white">
      {/* Top Document Header Bar */}
      <div className="w-full px-4 py-3 rounded-[24px] bg-black/20 backdrop-blur-xl border border-white/15 flex items-center justify-between z-10 shadow-lg">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center flex-shrink-0 border border-white/30">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate text-white">{sharedFile.name}</h3>
            <p className="text-[11px] text-white/70 flex items-center space-x-1">
              <span>Загрузил: {sharedFile.uploadedByName}</span>
            </p>
          </div>
        </div>

        {/* Top Right Controls: Transfer Control & Close */}
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center space-x-1 bg-white/10 rounded-xl p-1 border border-white/15">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="p-1 rounded-lg hover:bg-white/20 text-white/90"
              title="Уменьшить"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-1.5 text-white/80">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1 rounded-lg hover:bg-white/20 text-white/90"
              title="Увеличить"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 rounded-lg hover:bg-white/20 text-white/90"
              title="Сброс"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transfer control button */}
          {(isCreator || isController) && (
            <div className="relative">
              <button
                onClick={() => setShowTransferMenu((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
                title="Передать управление другому участнику"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Передать управление</span>
              </button>

              {/* Transfer Popover Menu */}
              {showTransferMenu && (
                <div className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-blue-950/90 backdrop-blur-2xl border border-white/30 shadow-2xl z-30">
                  <div className="text-[11px] font-semibold text-white/70 px-2 py-1 uppercase tracking-wider">
                    Передать управление:
                  </div>
                  <div className="space-y-1 mt-1">
                    {participants.map((p) => {
                      if (p.id === controllerId) return null;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onTransferControl(p.id);
                            setShowTransferMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-white hover:bg-white/20 flex items-center justify-between transition-colors"
                        >
                          <span>{p.id === currentUserId ? 'Себе' : p.name}</span>
                          <Unlock className="w-3 h-3 text-sky-300" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Close Document Button */}
          {(isCreator || isController) && (
            <button
              onClick={onRemoveFile}
              className="p-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/50 text-white border border-rose-400/40 transition-all shadow-sm"
              title="Закрыть файл"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Document Display Area */}
      <div className="flex-1 w-full flex items-center justify-center p-2 my-2 overflow-auto relative">
        {currentPageUrl ? (
          <div
            className="transition-transform duration-200 flex items-center justify-center max-h-full"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={currentPageUrl}
              alt={`Страница ${currentPage}`}
              className="max-h-[55dvh] sm:max-h-[62dvh] lg:max-h-[68dvh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        ) : (
          <div className="text-center p-8 text-white/80 bg-black/20 rounded-2xl border border-white/10">
            <FileText className="w-12 h-12 mx-auto mb-2 text-white/50" />
            <p className="text-sm">Загрузка документа...</p>
          </div>
        )}
      </div>

      {/* Bottom Floating Synchronized Page Control Bar */}
      <div className="w-full max-w-md px-4 py-2.5 rounded-full bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center justify-between text-white z-10">
        {/* Previous Page */}
        <button
          onClick={handlePrevPage}
          disabled={!canControl || currentPage <= 1}
          className={`p-2 rounded-full border transition-all ${
            canControl && currentPage > 1
              ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 active:scale-95'
              : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
          }`}
          title="Предыдущая страница"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Current Page Display e.g. "3 / 15" */}
        <div className="flex flex-col items-center">
          <div className="text-base font-semibold font-mono tracking-wide px-4 py-0.5 rounded-full bg-white/15 border border-white/20 text-white">
            {currentPage} / {totalPages}
          </div>
          <div className="text-[10px] text-white/70 mt-0.5 flex items-center space-x-1">
            {canControl ? (
              <span className="text-emerald-300 font-medium flex items-center">
                <Unlock className="w-3 h-3 inline mr-1" /> Вы управляете
              </span>
            ) : (
              <span className="text-white/70 flex items-center">
                <Lock className="w-3 h-3 inline mr-1" /> Управляет: {controllerName}
              </span>
            )}
          </div>
        </div>

        {/* Next Page */}
        <button
          onClick={handleNextPage}
          disabled={!canControl || currentPage >= totalPages}
          className={`p-2 rounded-full border transition-all ${
            canControl && currentPage < totalPages
              ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 active:scale-95'
              : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
          }`}
          title="Следующая страница"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
