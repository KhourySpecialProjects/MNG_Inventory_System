// Shared in-memory image store for local dev mode.
// Used by both items.ts and templates.ts so that images uploaded via one
// router can be retrieved by the other (e.g. template images on team items).
export const localImages = new Map<string, string>();
