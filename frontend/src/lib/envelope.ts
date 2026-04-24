/**
 * Phase UX-1 envelope contract — frontend side.
 *
 * Every read-path API response has a `status` field at root and preserves its
 * shape regardless of status value. Use these predicates to branch rendering.
 *
 * See: docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md §4.
 */

export type EnvelopeStatus = 'ready' | 'partial' | 'unavailable';

export interface StatusEnvelope {
  status: EnvelopeStatus;
}

export function isReady<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'ready';
}

export function isPartial<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'partial';
}

export function isUnavailable<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'unavailable';
}
