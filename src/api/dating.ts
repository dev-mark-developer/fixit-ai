import api from './axios';

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
  otherProfileImageUrl?: string;
  otherDisplayImageUrl?: string;
  matchedAt: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface ChatMessage {
  id: number;
  matchId: number;
  senderId: number;
  receiverId: number;
  content?: string;
  messageType: string;
  fileUrl?: string;
  sentAt: string;
  isRead: boolean;
}

export interface SwipeResult {
  isMatch: boolean;
  matchId?: number;
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

  // Discover
  discover: (params?: { page?: number; pageSize?: number }) =>
    api.get('/dating/discover', { params }),

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
