import api from './axios';

export interface MentorRequest {
  id: number;
  userId: number;
  status: string; // Pending | Assigned
  assignedMentorId?: number;
  assignedMentorName?: string;
  assignedMentorDisplayName?: string;
  assignedMentorImageUrl?: string;
  assignedAt?: string;
  createdAt: string;
}

export interface ExternalMentor {
  id: number;
  name: string;
  description?: string;
  profileImageUrl?: string;
  webPageUrl: string;
  isActive: boolean;
}

export interface AssignedUser {
  assignmentId: number;
  userId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  status: string; // Active | Completed | Removed
  assignedAt: string;
}

export interface MentorProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  displayName: string;
  bio: string;
  tagline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentorSubscription {
  id: number;
  planType: string;
  store: string;
  iapProductId: string;
  startDate: string;
  endDate: string;
  isTrialPeriod: boolean;
  status: string;
  isExpired: boolean;
  daysRemaining: number;
}

export const mentorApi = {
  // User-side: request a mentor
  getMyRequest: () => api.get('/mentor-request'),
  submitRequest: () => api.post('/mentor-request', {}),

  // Public: external mentors list
  getExternalMentors: () => api.get('/external-mentors'),

  // Mentor-side: profile
  getProfile: () => api.get('/mentor/profile'),
  saveProfile: (data: { displayName: string; bio: string; tagline?: string }) =>
    api.post('/mentor/profile', data),

  // Mentor-side: subscription
  getSubscription: () => api.get('/mentor/subscription'),
  recordSubscription: (data: {
    planType: string;
    store: string;
    iapProductId: string;
    iapTransactionId: string;
    startDate: string;
    endDate: string;
    isTrialPeriod?: boolean;
  }) => api.post('/mentor/subscription', data),

  // Mentor-side: assigned users
  getAssignedUsers: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get('/mentor/assigned-users', { params }),

  updateAssignmentStatus: (assignmentId: number, status: 'Completed' | 'Removed') =>
    api.patch(`/mentor/assigned-users/${assignmentId}/status`, { status }),
};
