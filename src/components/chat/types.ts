export type ChatUser = {
  id: string;
  name: string;
  email?: string;
  photo?: string | null;
  role?: string;
  department?: { name: string } | null;
  staffId?: string | null;
  lastSeen?: string | null;
};

export type Reaction = {
  id: string;
  emoji: string;
  userId: string;
  user: { name: string };
};

export type ReplyPreview = {
  id: string;
  content?: string | null;
  fileName?: string | null;
  sender: { name: string };
};

export type Message = {
  id: string;
  conversationId: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  edited: boolean;
  pinned: boolean;
  createdAt: string;
  sender: { id: string; name: string; photo?: string | null };
  replyTo?: ReplyPreview | null;
  reactions: Reaction[];
};

export type Participant = {
  id: string;
  name: string;
  photo?: string | null;
  lastSeen?: string | null;
  role?: string;
};

export type Conversation = {
  id: string;
  name: string;
  isGroup: boolean;
  participants: Participant[];
  lastMessage: string;
  lastTime: string;
  isOnline?: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  avatarUrl?: string | null;
};

export type UploadedFile = {
  url: string;
  name: string;
  type: string;
  size?: number;
};

export type CallType = "voice" | "video";

export type CallState = {
  status: "idle" | "calling" | "incoming" | "active" | "ended";
  callType: CallType | null;
  remoteUser: { id: string; name: string; photo?: string | null } | null;
  conversationId: string | null;
  sessionId: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
};