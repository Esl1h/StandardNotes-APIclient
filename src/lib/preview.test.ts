import { describe, expect, it } from 'vitest';
import { PREVIEW_LIMIT, httpPreview } from './preview';

describe('httpPreview', () => {
  it('lists the requests by method and title', () => {
    const note = '### Create\nPOST https://e.com\n\n### List\nGET https://e.com';
    expect(httpPreview(note)).toBe('2 requests: POST Create, GET List');
  });

  it('uses the singular for one request', () => {
    expect(httpPreview('### Create\nPOST https://e.com')).toBe('1 request: POST Create');
  });

  it('never carries a resolved variable value', () => {
    const preview = httpPreview('@token = secret\nGET https://e.com/?t={{token}}');
    expect(preview).not.toContain('secret');
    expect(preview).toContain('{{token}}');
  });

  it('falls back to the truncated text when there is no request', () => {
    // Two words on a line would already read as `METHOD url`.
    expect(httpPreview('shopping list   for today\nmilk, eggs and bread')).toBe(
      'shopping list for today milk, eggs and bread'
    );
    const preview = httpPreview('x'.repeat(500));
    expect(preview).toHaveLength(PREVIEW_LIMIT);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('is a single space for an empty note, never an empty string', () => {
    expect(httpPreview('')).toBe(' ');
  });

  it('stays within the limit for many requests', () => {
    const note = Array.from({ length: 50 }, (_, i) => `### Request ${i}\nGET https://e.com/${i}`);
    expect(httpPreview(note.join('\n\n')).length).toBeLessThanOrEqual(PREVIEW_LIMIT);
  });
});
