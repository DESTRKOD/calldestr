import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage, Participant } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      // TURNS over TLS: works even on networks that block plain TURN/UDP
      // (common on mobile carrier networks, corporate/public Wi-Fi, some VPNs).
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(
  socket: WebSocket | null,
  currentUserId: string,
  participants: Participant[],
  inCall: boolean
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  // Map of remoteUserId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(socket);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Helper to flush queued ICE candidates once remote description is set
  const flushIceCandidates = useCallback((targetUserId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidatesQueue.current.get(targetUserId) || [];
    if (queue.length > 0 && pc.remoteDescription) {
      queue.forEach((candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
          console.warn('Error adding queued ICE candidate:', err);
        });
      });
      iceCandidatesQueue.current.delete(targetUserId);
    }
  }, []);

  // 1. Initialize local media stream
  useEffect(() => {
    if (!inCall) {
      // Clean up local media stream when leaving call
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      setStreams(new Map());
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      iceCandidatesQueue.current.clear();
      return;
    }

    let isMounted = true;

    async function initLocalStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Support front camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        if (isMounted) {
          localStreamRef.current = stream;
          setLocalStream(stream);

          setStreams((prev) => {
            const next = new Map(prev);
            next.set(currentUserId, stream);
            return next;
          });
        }
      } catch (err) {
        console.warn('getUserMedia error (trying audio-only fallback):', err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isMounted) {
            localStreamRef.current = audioStream;
            setLocalStream(audioStream);
            setCameraOn(false);
            setStreams((prev) => {
              const next = new Map(prev);
              next.set(currentUserId, audioStream);
              return next;
            });
          }
        } catch (audioErr) {
          console.warn('Media permissions denied or devices unavailable:', audioErr);
          if (isMounted) {
            const emptyStream = new MediaStream();
            localStreamRef.current = emptyStream;
            setLocalStream(emptyStream);
            setCameraOn(false);
            setMicOn(false);
            setStreams((prev) => {
              const next = new Map(prev);
              next.set(currentUserId, emptyStream);
              return next;
            });
          }
        }
      }
    }

    initLocalStream();

    return () => {
      isMounted = false;
    };
  }, [inCall, currentUserId]);

  // Helper to add or replace local tracks on a PeerConnection
  const addLocalTracksToPC = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const senders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const existingSender =
        senders.find((s) => s.track?.kind === track.kind) ||
        senders.find((s) => !s.track);

      if (existingSender) {
        if (existingSender.track !== track) {
          existingSender.replaceTrack(track).catch((e) => console.warn('replaceTrack error:', e));
        }
      } else {
        try {
          pc.addTrack(track, stream);
        } catch (e) {
          console.warn('addTrack error:', e);
        }
      }
    });
  }, []);

  // Helper to create RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      if (peerConnections.current.has(targetUserId)) {
        return peerConnections.current.get(targetUserId)!;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Pre-add sendrecv transceivers for audio and video so SDP always includes media sections
      try {
        if (!pc.getTransceivers().some((t) => t.receiver.track.kind === 'audio')) {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        }
        if (!pc.getTransceivers().some((t) => t.receiver.track.kind === 'video')) {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } catch (e) {
        console.warn('Transceiver init warning:', e);
      }

      // Add local tracks if available
      if (localStreamRef.current) {
        addLocalTracksToPC(pc, localStreamRef.current);
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'webrtc:candidate',
              payload: {
                targetId: targetUserId,
                candidate: event.candidate,
              },
            })
          );
        }
      };

      // Handle incoming remote stream
      pc.ontrack = (event) => {
        const remoteTrack = event.track;

        remoteTrack.onunmute = () => {
          setStreams((prev) => new Map(prev));
        };

        setStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetUserId);
          let newStream: MediaStream;

          if (existing) {
            if (!existing.getTracks().some((t) => t.id === remoteTrack.id)) {
              existing.addTrack(remoteTrack);
            }
            newStream = new MediaStream(existing.getTracks());
          } else {
            if (event.streams && event.streams[0]) {
              newStream = new MediaStream(event.streams[0].getTracks());
            } else {
              newStream = new MediaStream([remoteTrack]);
            }
          }

          next.set(targetUserId, newStream);
          return next;
        });
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] connectionState with ${targetUserId}:`, pc.connectionState);

        if (pc.connectionState === 'failed') {
          // Try to self-heal instead of giving up immediately. On mobile networks
          // (cellular NAT) the first ICE negotiation can fail even though a working
          // relay path exists; an ICE restart often recovers without user action.
          // Only the deterministic "offerer" side re-negotiates, to match this
          // codebase's existing glare-avoidance rule (currentUserId < peerId).
          const isOfferer = currentUserId < targetUserId;
          if (isOfferer) {
            pc.createOffer({ iceRestart: true }).then((offer) => {
              return pc.setLocalDescription(offer).then(() => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  socketRef.current.send(
                    JSON.stringify({
                      type: 'webrtc:offer',
                      payload: { targetId: targetUserId, offer },
                    })
                  );
                }
              });
            }).catch((err) => console.warn('ICE restart offer failed:', err));
          }
        }

        if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          setStreams((prev) => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] iceConnectionState with ${targetUserId}:`, pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[WebRTC] iceGatheringState with ${targetUserId}:`, pc.iceGatheringState);
      };

      peerConnections.current.set(targetUserId, pc);
      return pc;
    },
    [addLocalTracksToPC]
  );

  // Sync peer connections with current participants and localStream
  useEffect(() => {
    if (!inCall || !currentUserId) return;

    participants.forEach(async (p) => {
      if (p.id === currentUserId) return;

      const pcExisted = peerConnections.current.has(p.id);
      const pc = createPeerConnection(p.id);

      if (localStreamRef.current) {
        addLocalTracksToPC(pc, localStreamRef.current);
      }

      const isOfferer = currentUserId < p.id;

      if (
        (!pcExisted && isOfferer) ||
        (pcExisted && localStreamRef.current && isOfferer && pc.signalingState === 'stable')
      ) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: 'webrtc:offer',
                payload: {
                  targetId: p.id,
                  offer: offer,
                },
              })
            );
          }
        } catch (err) {
          console.error('Error creating offer:', err);
        }
      }
    });

    // Cleanup disconnected peers
    peerConnections.current.forEach((pc, id) => {
      if (!participants.some((p) => p.id === id)) {
        pc.close();
        peerConnections.current.delete(id);
        iceCandidatesQueue.current.delete(id);
        setStreams((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }, [participants, inCall, localStream, currentUserId, createPeerConnection, addLocalTracksToPC]);

  // Trigger renegotiation when localStream becomes available or updates
  useEffect(() => {
    if (!localStream || !inCall) return;

    peerConnections.current.forEach(async (pc, targetUserId) => {
      addLocalTracksToPC(pc, localStream);

      if (pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: 'webrtc:offer',
                payload: {
                  targetId: targetUserId,
                  offer,
                },
              })
            );
          }
        } catch (err) {
          console.warn('Error during localStream renegotiation:', err);
        }
      }
    });
  }, [localStream, inCall, addLocalTracksToPC]);

  // Handle incoming signaling messages
  const handleSignalMessage = useCallback(
    async (msg: WSMessage) => {
      if (!inCall) return;

      const { fromId, offer, answer, candidate } = msg.payload || {};
      if (!fromId) return;

      const pc = createPeerConnection(fromId);
      if (localStreamRef.current) {
        addLocalTracksToPC(pc, localStreamRef.current);
      }

      switch (msg.type) {
        case 'webrtc:offer': {
          try {
            if (pc.signalingState !== 'stable') {
              const isPolite = currentUserId > fromId;
              if (!isPolite) {
                console.warn('Ignoring offer glare from', fromId);
                break;
              }
              if (pc.signalingState === 'have-local-offer') {
                await pc.setLocalDescription({ type: 'rollback' });
              }
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            flushIceCandidates(fromId, pc);

            if (localStreamRef.current) {
              addLocalTracksToPC(pc, localStreamRef.current);
            }

            const answerDesc = await pc.createAnswer();
            await pc.setLocalDescription(answerDesc);

            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(
                JSON.stringify({
                  type: 'webrtc:answer',
                  payload: {
                    targetId: fromId,
                    answer: answerDesc,
                  },
                })
              );
            }
          } catch (err) {
            console.error('Error handling offer:', err);
          }
          break;
        }

        case 'webrtc:answer': {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            flushIceCandidates(fromId, pc);
          } catch (err) {
            console.error('Error setting remote description from answer:', err);
          }
          break;
        }

        case 'webrtc:candidate': {
          try {
            if (candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                const currentQueue = iceCandidatesQueue.current.get(fromId) || [];
                iceCandidatesQueue.current.set(fromId, [...currentQueue, candidate]);
              }
            }
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
          break;
        }
      }
    },
    [inCall, createPeerConnection, addLocalTracksToPC, flushIceCandidates]
  );

  // Toggle local mic
  const toggleMic = useCallback(async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    let audioTrack = localStreamRef.current.getAudioTracks()[0];

    if (!audioTrack) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          localStreamRef.current.addTrack(audioTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (err) {
        console.warn('Microphone permission or device error:', err);
        return;
      }
    } else {
      audioTrack.enabled = !audioTrack.enabled;
    }

    const newMicState = audioTrack ? audioTrack.enabled : false;
    setMicOn(newMicState);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'user:update_media',
          payload: {
            cameraOn,
            micOn: newMicState,
          },
        })
      );
    }
  }, [cameraOn]);

  // Toggle local camera
  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    let videoTrack = localStreamRef.current.getVideoTracks()[0];

    if (!videoTrack) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          localStreamRef.current.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (err) {
        console.warn('Camera permission or device error:', err);
        return;
      }
    } else {
      videoTrack.enabled = !videoTrack.enabled;
    }

    const newCameraState = videoTrack ? videoTrack.enabled : false;
    setCameraOn(newCameraState);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'user:update_media',
          payload: {
            cameraOn: newCameraState,
            micOn,
          },
        })
      );
    }
  }, [micOn]);

  return {
    localStream,
    streams,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    handleSignalMessage,
  };
}
