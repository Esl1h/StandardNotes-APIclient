import { parseHttpFile } from './parser';

const PREVIEW_LIMIT = 160;

/** One line of at most PREVIEW_LIMIT characters; never empty, or the app
 * would fall back to showing the whole note text. */
function truncatePreview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') {
    return ' ';
  }
  return flat.length > PREVIEW_LIMIT ? `${flat.slice(0, PREVIEW_LIMIT - 1)}…` : flat;
}

/** The requests of the note, by method and title (titles are the raw text
 * of the note, so no resolved variable value ends up in the preview). */
function httpPreview(text: string): string {
  const { requests } = parseHttpFile(text);
  if (requests.length === 0) {
    return truncatePreview(text);
  }
  const label = requests.length === 1 ? '1 request' : `${requests.length} requests`;
  const list = requests.map((request) => `${request.method} ${request.title}`).join(', ');
  return truncatePreview(`${label}: ${list}`);
}

export { PREVIEW_LIMIT, httpPreview, truncatePreview };
