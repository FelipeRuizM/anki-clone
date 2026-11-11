import { useMemo } from 'react'

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Tiny, safe rich-text renderer for card content:
 * **bold**, *italic*, `code`, newlines, and furigana ruby via 漢字[かんじ].
 */
export function richHtml(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  // Ruby only after CJK runs, so English "word [note]" stays untouched.
  s = s.replace(
    /([㐀-鿿豈-﫿々〆ヶ]+)\[([^\]\n]{1,30})\]/g,
    '<ruby>$1<rt>$2</rt></ruby>',
  )
  s = s.replaceAll('\n', '<br/>')
  return s
}

export default function Rich({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => richHtml(text), [text])
  return (
    <div
      className={`card-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
