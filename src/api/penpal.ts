import api from './axios';

export interface PenpalProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  letterType: string;
  pseudoName: string;
  identityVisibility: string;
  addressLine1?: string;
  addressLine2?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  physicalConsentGiven: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PenpalDiscoverItem {
  userId: number;
  profileImageUrl?: string;
  pseudoName: string;
  letterType: string;
  identityVisibility: string;
  state?: string;
  city?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  /** None | Pending | Accepted — added by the backend (gap #1) */
  connectionStatus?: string;
  /** Added by the backend (gap #2) */
  age?: number;
}

export interface PenpalConnection {
  id: number;
  requesterId: number;
  requesterPseudoName: string;
  requesterImageUrl?: string;
  requesterLetterType: string;
  requesterAddressLine1?: string;
  requesterCity?: string;
  requesterState?: string;
  requesterPostalCode?: string;
  receiverId: number;
  receiverPseudoName: string;
  receiverImageUrl?: string;
  receiverLetterType: string;
  receiverAddressLine1?: string;
  receiverCity?: string;
  receiverState?: string;
  receiverPostalCode?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PenpalLetter {
  id: number;
  senderId: number;
  senderPseudoName: string;
  senderImageUrl?: string;
  receiverId: number;
  receiverPseudoName: string;
  receiverImageUrl?: string;
  title: string;
  content: string;
  createdAt: string;
}

export const penpalApi = {
  getProfile: () => api.get('/penpal/profile'),

  checkPseudoName: (name: string) =>
    api.get<{ data: { isAvailable: boolean } }>('/penpal/check-pseudo-name', { params: { name } }),

  saveProfile: (data: {
    letterType: string;
    pseudoName: string;
    identityVisibility: string;
    addressLine1?: string;
    addressLine2?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    physicalConsentGiven: boolean;
    latitude?: number;
    longitude?: number;
  }) => api.post('/penpal/profile', data),

  discover: (params?: { search?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get('/penpal/discover', { params }),

  sendConnection: (receiverId: number) =>
    api.post('/penpal/connections', { receiverId }),

  getConnections: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/penpal/connections', { params }),

  respondConnection: (connectionId: number, status: 'Accepted' | 'Declined') =>
    api.patch(`/penpal/connections/${connectionId}/respond`, { status }),

  cancelConnection: (connectionId: number) =>
    api.delete(`/penpal/connections/${connectionId}`),

  removeConnection: (connectionId: number) =>
    api.delete(`/penpal/connections/${connectionId}/remove`),

  getLetters: (params?: {
    direction?: 'Inbox' | 'Sent';
    /** Per-penpal conversation thread — added by the backend (gap #3) */
    withUserId?: number;
    page?: number;
    pageSize?: number;
  }) => api.get('/penpal/letters', { params }),

  getLetter: (letterId: number) => api.get(`/penpal/letters/${letterId}`),

  sendLetter: (receiverId: number, title: string, content: string) =>
    api.post('/penpal/letters', { receiverId, title, content }),
};
