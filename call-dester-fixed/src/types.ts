export interface Participant {
  id: string;
  name: string;
  isOwner: boolean;
  cameraOn: boolean;
  micOn: boolean;
  joinedAt: number;
}

export interface SharedFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'presentation';
  totalPages: number;
  currentPage: number;
  dataUrl?: string; // For single image
  pagesDataUrls?: string[]; // Array of page data URLs for multi-page documents
  uploadedBy: string;
  uploadedByName: string;
}

export interface RoomState {
  exists: boolean;
  roomId: string;
  creatorId: string;
  controllerId: string; // User ID who can flip pages
  participants: Participant[];
  maxParticipants: number;
  sharedFile: SharedFile | null;
}

export type WSMessageType =
  | 'room:state'
  | 'room:create'
  | 'room:join'
  | 'room:leave'
  | 'user:update_media'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:candidate'
  | 'file:upload'
  | 'file:remove'
  | 'file:page_change'
  | 'control:transfer'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  payload?: any;
}
