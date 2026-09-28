import api from './axios';

/** The pages the admin panel edits. Public — no sign-in needed. */
export type ContentPageSlug = 'terms-and-conditions' | 'privacy-policy' | 'user-guidelines';

export interface ContentPage {
  slug: ContentPageSlug;
  title: string;
  /** Admin-authored HTML: p, h2, h3, ul/li, em, br, and mailto links. */
  bodyHtml: string;
  updatedAt: string;
}

export const contentApi = {
  getPage: (slug: ContentPageSlug) =>
    api.get<{ data: ContentPage }>(`/content/pages/${slug}`),
};
