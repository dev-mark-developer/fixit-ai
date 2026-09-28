import api from './axios';

/**
 * What a report points at, beyond the person. The server checks that the
 * message or letter was sent by `reportedUserId`, and refuses a second report
 * of the same one ("You have already reported this letter.").
 * ChatMessage belongs to Dating, PenpalLetter to Penpal.
 */
export interface ReportTarget {
  type: 'ChatMessage' | 'PenpalLetter';
  id: number;
}

export const sharedApi = {
  reportUser: (
    reportedUserId: number,
    reason: string,
    module: 'Dating' | 'Penpal',
    target?: ReportTarget,
  ) =>
    api.post('/reports', {
      reportedUserId,
      reason,
      module,
      ...(target ? { targetType: target.type, targetId: target.id } : {}),
    }),

  // One block list for the whole account: `/blocks` takes no module, so a
  // block made in Dating also counts in Penpal and the other way round.
  getBlocks: () => api.get('/blocks'),
  block: (blockedUserId: number) => api.post('/blocks', { blockedUserId }),
  unblock: (blockedUserId: number) => api.delete(`/blocks/${blockedUserId}`),
};
