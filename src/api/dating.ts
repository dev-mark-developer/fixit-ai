import api from './axios';
import { buildUploadPart } from '../utils/uploadPart';

export interface DatingProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  datingType: string;
  about?: string;
  interestedInGender: string;
  displayImageId?: number;
  displayImageUrl?: string;
  images: DatingImage[];
  interestIds: number[];
  iceBreakerQuestionIds: number[];
  // Added by the backend (gap #8)
  pseudoName?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatingImage {
  id: number;
  userId: number;
  imageUrl: string;
  displayOrder: number;
  createdAt: string;
}

export interface InterestCategory {
  id: number;
  name: string;
  datingType: string;
  interests: Interest[];
}

export interface Interest {
  id: number;
  categoryId: number;
  name: string;
}

export interface DiscoverUser {
  userId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  displayImageUrl?: string;
  datingType: string;
  about?: string;
  interestedInGender: string;
  country?: string;
  city?: string;
  age?: number;
  interests: string[];
  iceBreakerQuestions: string[];
  images: string[];
}

export interface DatingMatch {
  id: number;
  otherUserId: number;
  otherFirstName: string;
  otherLastName: string;
  otherPseudoName?: string | null;
  otherProfileImageUrl?: string;
  otherDisplayImageUrl?: string;
  otherAge?: number;
  matchedAt: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

/** The only attachment kinds the chat hub accepts. */
export type ChatFileType = 'Image' | 'Video' | 'VoiceNote';

export interface ChatAttachment {
  /** Absent on the payload we send up, present on everything the server returns. */
  id?: number;
  fileUrl: string;
  fileType: ChatFileType;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  sortOrder?: number;
}

export interface ChatMessage {
  id: number;
  matchId: number;
  senderId: number;
  receiverId: number;
  content?: string | null;
  /** 'Text' when there are no files, else the FIRST attachment's type. */
  messageType: string;
  /** Legacy mirror of `attachments[0].fileUrl` — read `attachments` instead. */
  fileUrl?: string | null;
  attachments?: ChatAttachment[];
  /**
   * Hub payloads end in `Z`; REST history carries NO zone marker.
   * Always read this through `parseChatDate` in `utils/chatMedia`.
   */
  sentAt: string;
  isRead: boolean;
}

/** A local file staged for upload (image picker / voice recorder output). */
export interface ChatUploadFile {
  uri: string;
  name: string;
  /** MIME type — the API only accepts `image/*`, `video/*` and `audio/*`. */
  type: string;
}

/** Max files the hub will accept on a single message. */
export const MAX_CHAT_ATTACHMENTS = 10;

export interface SwipeResult {
  isMatch: boolean;
  matchId?: number;
}

/**
 * Row returned by the likes endpoints (gap #7). The response shape isn't
 * typed in Swagger, so field names are optional and read defensively.
 */
export interface DatingLike {
  userId?: number;
  otherUserId?: number;
  id?: number;
  firstName?: string;
  lastName?: string;
  pseudoName?: string | null;
  age?: number;
  city?: string;
  country?: string;
  profileImageUrl?: string;
  displayImageUrl?: string;
  otherProfileImageUrl?: string;
  otherDisplayImageUrl?: string;
  otherFirstName?: string;
  otherLastName?: string;
  action?: string;
  createdAt?: string;
}

export interface VettingQuestion {
  id: number;
  question: string;
  displayOrder: number;
  options: VettingOption[];
}

export interface VettingOption {
  id: number;
  questionId: number;
  optionText: string;
  displayOrder: number;
}

export interface SpiritualRequest {
  id: number;
  userId: number;
  documentUrl: string;
  status: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface IceBreakerQuestion {
  id: number;
  question: string;
  isActive: boolean;
}

export const datingApi = {
  // Profile
  getProfile: () => api.get('/dating/profile'),
  saveProfile: (data: {
    datingType: string;
    about?: string;
    interestedInGender: string;
    displayImageId?: number;
    latitude?: number;
    longitude?: number;
    // Added by the backend (gap #8)
    pseudoName?: string;
    dateOfBirth?: string; // YYYY-MM-DD
    country?: string;
    city?: string;
    state?: string;
  }) => api.post('/dating/profile', data),

  // Images
  uploadImage: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    form.append('file', { uri, name: 'dating.jpg', type: mimeType } as any);
    return api.post('/dating/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteImage: (imageId: number) => api.delete(`/dating/images/${imageId}`),
  setDisplayImage: (imageId: number) => api.patch(`/dating/profile/display-image/${imageId}`),

  // Interests
  getInterests: (datingType?: string) =>
    api.get('/dating/interests', { params: datingType ? { datingType } : undefined }),
  setInterests: (interestIds: number[]) => api.post('/dating/interests', { interestIds }),

  // Ice Breakers
  getIceBreakers: () => api.get('/dating/icebreakers'),
  setIceBreakers: (questionIds: number[]) => api.post('/dating/icebreakers', { questionIds }),

  // Discover — filter params added by the backend (gap #6)
  discover: (params?: {
    page?: number;
    pageSize?: number;
    country?: string;
    interestedInGender?: string;
    minAge?: number;
    maxAge?: number;
    distanceKm?: number;
    interestIds?: number[];
  }) =>
    api.get('/dating/discover', {
      params: params && {
        page: params.page,
        pageSize: params.pageSize,
        Country: params.country,
        InterestedInGender: params.interestedInGender,
        MinAge: params.minAge,
        MaxAge: params.maxAge,
        DistanceKm: params.distanceKm,
        InterestIds: params.interestIds,
      },
    }),

  // Likes — endpoints added by the backend (gap #7)
  getLikesReceived: (params?: { page?: number; pageSize?: number }) =>
    api.get('/dating/likes/received', { params }),
  getLikesSent: (params?: { page?: number; pageSize?: number }) =>
    api.get('/dating/likes/sent', { params }),

  // Swipe
  swipe: (swipedUserId: number, action: 'Like' | 'SuperLike' | 'Ignore') =>
    api.post('/dating/swipe', { swipedUserId, action }),

  // Matches
  getMatches: () => api.get('/dating/matches'),

  // Messages
  getMessages: (matchId: number, params?: { page?: number; pageSize?: number }) =>
    api.get(`/dating/matches/${matchId}/messages`, { params }),
  markMessagesRead: (matchId: number) =>
    api.patch(`/dating/matches/${matchId}/messages/read`),

  // Chat attachments — upload first, then send the returned descriptors over
  // SignalR with `SendMessageWithAttachments`.
  /**
   * Up to {@link MAX_CHAT_ATTACHMENTS} files in one call. Only `image/*`,
   * `video/*` and `audio/*` are accepted; anything else comes back 400.
   * Resolves to `ChatAttachment[]` in `data.data`.
   */
  uploadChatFiles: async (matchId: number, files: ChatUploadFile[]) => {
    const form = new FormData();
    // `buildUploadPart` is what keeps the declared MIME type intact on iOS.
    for (const file of files) {
      form.append('files', (await buildUploadPart(file)) as any);
    }
    return api.post(`/dating/matches/${matchId}/uploads`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Video/voice payloads routinely outrun the 25s instance default.
      timeout: 120000,
    });
  },
  /** Legacy single-file upload — resolves to the file URL string in `data.data`. */
  uploadChatFile: async (matchId: number, file: ChatUploadFile) => {
    const form = new FormData();
    form.append('file', (await buildUploadPart(file)) as any);
    return api.post(`/dating/matches/${matchId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },

  // Vetting
  getVettingQuestions: () => api.get('/dating/vetting/questions'),
  submitVetting: (answers: { questionId: number; selectedOptionId: number }[]) =>
    api.post('/dating/vetting/submit', { answers }),

  // Spiritual request
  getSpiritualRequest: () => api.get('/dating/spiritual-request'),
  submitSpiritualRequest: (documentUri: string, mimeType = 'application/pdf') => {
    const form = new FormData();
    form.append('document', { uri: documentUri, name: 'certificate.pdf', type: mimeType } as any);
    return api.post('/dating/spiritual-request', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Subscription
  getSubscription: (planType: string) => api.get(`/dating/subscription/${planType}`),
  recordSubscription: (data: {
    planType: string;
    store: string;
    iapProductId: string;
    iapTransactionId: string;
    startDate: string;
    endDate: string;
    isTrialPeriod: boolean;
  }) => api.post('/dating/subscription', data),
  cancelSubscription: (subscriptionId: number) =>
    api.delete(`/dating/subscription/${subscriptionId}`),

  // Matches
  unmatch: (matchId: number) => api.delete(`/dating/matches/${matchId}`),

  // Blocks
  getBlocks: () => api.get('/blocks'),
  block: (blockedUserId: number) => api.post('/blocks', { blockedUserId }),
  unblock: (blockedUserId: number) => api.delete(`/blocks/${blockedUserId}`),
};
