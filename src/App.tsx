import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { MainScreen } from './components/MainScreen';
import { NameModal } from './components/NameModal';
import { VideoGrid } from './components/VideoGrid';
import { DocumentViewer } from './components/DocumentViewer';
import { ControlsDock } from './components/ControlsDock';
import { useWebRTC } from './lib/useWebRTC';
import { processUploadedFile } from './lib/pdfUtils';
import { RoomState, WSMessage } from './types';
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Generate or retrieve persistent user ID
  const [userId] = useState(() => {
    let id = sessionStorage.getItem('dester_user_id');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('dester_user_id', id);
    }
    return id;
  });

  // Room state synchronized with server
  const [roomState, setRoomState] = useState<RoomState>({
    exists: false,
    roomId: 'dester-main-room',
    creatorId: '',
    controllerId: '',
    participants: [],
    maxParticipants: 3,
    sharedFile: null,
  });

  const [inCall, setInCall] = useState(false);
  const inCallRef = useRef(inCall);
  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'create' | 'join'>('create');
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // WebRTC Hook
  const {
    streams,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    handleSignalMessage,
  } = useWebRTC(socket, userId, roomState.participants, inCall);

  const handleSignalMessageRef = useRef(handleSignalMessage);
  useEffect(() => {
    handleSignalMessageRef.current = handleSignalMessage;
  }, [handleSignalMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Establish WebSocket Connection to Server with Keep-Alive & Auto-Reconnect
  useEffect(() => {
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Call Dester WebSocket server');
        setSocket(ws);

        // Send periodic ping every 15s to keep connection alive
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);

        // If user was in a call when disconnected, re-join automatically
        const storedName = sessionStorage.getItem('dester_user_name');
        if (inCallRef.current && storedName) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              payload: { name: storedName, userId },
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'room:state': {
              setRoomState(msg.payload);

              // Check if current user is still in participants list
              const isUserInRoom = msg.payload.participants?.some(
                (p: any) => p.id === userId
              );
              if (!isUserInRoom && inCallRef.current) {
                // If room doesn't exist, exit call
                if (!msg.payload.exists) {
                  setInCall(false);
                }
              }
              break;
            }

            case 'webrtc:offer':
            case 'webrtc:answer':
            case 'webrtc:candidate': {
              handleSignalMessageRef.current(msg);
              break;
            }

            case 'error': {
              showToast(msg.payload?.message || 'Произошла ошибка');
              break;
            }
          }
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting in 2s...');
        setSocket(null);
        if (pingInterval) clearInterval(pingInterval);

        if (isComponentMounted) {
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };
    }

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [userId]);

  // Handle user action to open Name modal
  const handleOpenNameModal = (action: 'create' | 'join') => {
    setModalAction(action);
    setIsNameModalOpen(true);
  };

  // Submit name & send room:create or room:join to server
  const handleNameSubmit = (userName: string) => {
    setIsNameModalOpen(false);
    sessionStorage.setItem('dester_user_name', userName);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      if (modalAction === 'create') {
        socketRef.current.send(
          JSON.stringify({
            type: 'room:create',
            payload: { name: userName, userId },
          })
        );
      } else {
        socketRef.current.send(
          JSON.stringify({
            type: 'room:join',
            payload: { name: userName, userId },
          })
        );
      }
      setInCall(true);
      showToast(modalAction === 'create' ? 'Звонок создан' : 'Вы вошли в звонок');
    }
  };

  // Leave Call
  const handleLeaveCall = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'room:leave',
          payload: { userId },
        })
      );
    }
    setInCall(false);
    showToast('Вы вышли из звонка');
  };

  // File Upload handler
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const parsedDoc = await processUploadedFile(file);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'file:upload',
            payload: {
              name: parsedDoc.name,
              type: parsedDoc.type,
              totalPages: parsedDoc.totalPages,
              dataUrl: parsedDoc.dataUrl,
              pagesDataUrls: parsedDoc.pagesDataUrls,
            },
          })
        );
        showToast('Файл успешно прикреплен');
      }
    } catch (err) {
      console.error('File upload error:', err);
      showToast('Не удалось обработать файл');
    } finally {
      setIsUploading(false);
    }
  };

  // File Page Navigation handler
  const handlePageChange = (newPage: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'file:page_change',
          payload: { page: newPage },
        })
      );
    }
  };

  // File Remove handler
  const handleRemoveFile = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'file:remove',
        })
      );
      showToast('Файл закрыт');
    }
  };

  // Transfer Document Control handler
  const handleTransferControl = (targetUserId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'control:transfer',
          payload: { targetUserId },
        })
      );

      const target = roomState.participants.find((p) => p.id === targetUserId);
      showToast(`Управление передано: ${target ? target.name : 'Участник'}`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-[#1e3a8a] via-[#3b82f6] to-[#dbeafe] text-slate-100 font-sans flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Glass Header */}
      <Header
        roomExists={roomState.exists}
        participants={roomState.participants}
        maxParticipants={roomState.maxParticipants}
        currentUserId={userId}
        inCall={inCall}
      />

      {/* Main Content View */}
      <main className="flex-1 flex flex-col relative z-10 w-full overflow-hidden p-3 sm:p-6 max-w-[1400px] mx-auto">
        {!inCall ? (
          /* Main Screen before joining/creating call */
          <MainScreen
            roomState={roomState}
            onCreateCall={() => handleOpenNameModal('create')}
            onJoinCall={() => handleOpenNameModal('join')}
          />
        ) : (
          /* Active Call Screen */
          <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden pb-24">
            {roomState.sharedFile ? (
              /* Bento Grid layout when a file is attached: Main Document + Sidebar Videos */
              <div className="flex-1 grid grid-cols-12 gap-4 lg:gap-6 w-full h-full overflow-hidden items-stretch">
                <div className="col-span-12 lg:col-span-9 h-full flex flex-col min-h-0">
                  <DocumentViewer
                    sharedFile={roomState.sharedFile}
                    currentUserId={userId}
                    controllerId={roomState.controllerId}
                    creatorId={roomState.creatorId}
                    participants={roomState.participants}
                    onPageChange={handlePageChange}
                    onRemoveFile={handleRemoveFile}
                    onTransferControl={handleTransferControl}
                  />
                </div>
                <div className="col-span-12 lg:col-span-3 h-auto lg:h-full flex flex-col min-h-0 overflow-y-auto">
                  <VideoGrid
                    participants={roomState.participants}
                    currentUserId={userId}
                    controllerId={roomState.controllerId}
                    creatorId={roomState.creatorId}
                    streams={streams}
                    compactMode={true}
                  />
                </div>
              </div>
            ) : (
              /* When no file is attached: Show full Video Grid */
              <VideoGrid
                participants={roomState.participants}
                currentUserId={userId}
                controllerId={roomState.controllerId}
                creatorId={roomState.creatorId}
                streams={streams}
                compactMode={false}
              />
            )}

            {/* Floating Bento Bottom Control Dock */}
            <ControlsDock
              micOn={micOn}
              cameraOn={cameraOn}
              hasSharedFile={!!roomState.sharedFile}
              isUploadingFile={isUploading}
              canTransferControl={userId === roomState.creatorId || userId === roomState.controllerId}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              onFileUpload={handleFileUpload}
              onLeaveCall={handleLeaveCall}
            />
          </div>
        )}
      </main>

      {/* Name Input Modal */}
      <NameModal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        onSubmit={handleNameSubmit}
        actionType={modalAction}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-2xl border border-white/20 text-white text-xs font-medium shadow-2xl flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
