export const noteKey = (id: string) => `n:${id}`;
export const groupKey = (id: string) => `g:${id}`;
export const META_UID = 'meta:uid';
export const cursorKey = (collection: 'notes' | 'groups') => `meta:cursor:${collection}`;
