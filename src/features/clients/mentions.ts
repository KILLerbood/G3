/** @mentions in client notes: find who is mentioned, and help the composer autocomplete. Pure. */

/** Names mentioned as «@name» in the text (longest names win, each name once, in team order). */
export function findMentions(text: string, names: string[]): string[] {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const found = new Set<string>();
  let rest = text;
  sorted.forEach((n) => {
    const tag = '@' + n;
    if (rest.includes(tag)) { found.add(n); rest = rest.split(tag).join(' '); }
  });
  return names.filter((n) => found.has(n));
}

/** The word being typed after «@» at the caret, or null when the caret isn't in a mention. */
export function mentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const q = before.slice(at + 1);
  if (/\n/.test(q) || q.length > 24) return null;
  return q;
}

/** Replaces the partial mention at the caret with the full name. Returns the new text and caret. */
export function insertMention(text: string, caret: number, name: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return { text, caret };
  const head = text.slice(0, at) + '@' + name + ' ';
  return { text: head + text.slice(caret).replace(/^\S*/, ''), caret: head.length };
}

/** Text split into plain parts and mention parts, for rendering. */
export function splitMentions(text: string, names: string[]): { mention: boolean; v: string }[] {
  const ms = findMentions(text, names).sort((a, b) => b.length - a.length);
  if (!ms.length) return [{ mention: false, v: text }];
  const re = new RegExp('(' + ms.map((m) => '@' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  return text.split(re).filter((p) => p !== '').map((p) => ({ mention: ms.some((m) => '@' + m === p), v: p }));
}
