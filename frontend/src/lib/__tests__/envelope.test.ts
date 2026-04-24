import { isReady, isPartial, isUnavailable, type StatusEnvelope } from '../envelope';

describe('envelope predicates', () => {
  test('isReady returns true only for ready status', () => {
    const ready: StatusEnvelope = { status: 'ready' };
    const partial: StatusEnvelope = { status: 'partial' };
    const unavailable: StatusEnvelope = { status: 'unavailable' };
    expect(isReady(ready)).toBe(true);
    expect(isReady(partial)).toBe(false);
    expect(isReady(unavailable)).toBe(false);
  });

  test('isPartial returns true only for partial status', () => {
    expect(isPartial({ status: 'partial' })).toBe(true);
    expect(isPartial({ status: 'ready' })).toBe(false);
    expect(isPartial({ status: 'unavailable' })).toBe(false);
  });

  test('isUnavailable returns true only for unavailable status', () => {
    expect(isUnavailable({ status: 'unavailable' })).toBe(true);
    expect(isUnavailable({ status: 'ready' })).toBe(false);
    expect(isUnavailable({ status: 'partial' })).toBe(false);
  });

  test('predicates narrow types for envelopes with domain fields', () => {
    interface Briefing extends StatusEnvelope {
      events: string[];
    }
    const envelope: Briefing = { status: 'ready', events: ['a'] };
    if (isReady(envelope)) {
      // TS should still see `events` on the narrowed type.
      expect(envelope.events).toEqual(['a']);
    }
  });
});
