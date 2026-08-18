import api from './axios';

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileImageUrl?: string;
  gender?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  state?: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  state?: string;
  gender?: string;
}

export const usersApi = {
  getProfile: () => api.get<{ data: UserProfile }>('/users/me'),

  updateProfile: (data: UpdateProfilePayload) => api.patch('/users/me', data),

  uploadProfileImage: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    form.append('file', { uri, name: 'profile.jpg', type: mimeType } as any);
    return api.post('/users/me/profile-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Sign-up photo — uploaded before the account exists (no auth), then the
   * returned URL is sent as `profilePictureUrl` on POST /auth/register.
   */
  uploadRegistrationImage: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    form.append('file', { uri, name: 'profile.jpg', type: mimeType } as any);
    return api.post('/auth/register/profile-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
