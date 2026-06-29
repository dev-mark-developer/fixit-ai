import api from './axios';

export const sharedApi = {
  reportUser: (reportedUserId: number, reason: string, module: 'Dating' | 'Penpal') =>
    api.post('/reports', { reportedUserId, reason, module }),
};
