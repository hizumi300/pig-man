export const MAX_NAME_LENGTH = 8;
const segments = new Intl.Segmenter('ja', { granularity: 'grapheme' });
export function normalizeDisplayName(value: string) { return value.normalize('NFKC').trim(); }
// 日本語・サロゲートペア・結合文字を、見た目の文字単位で数える。
export function nameLength(value: string) { return Array.from(segments.segment(normalizeDisplayName(value))).length; }
