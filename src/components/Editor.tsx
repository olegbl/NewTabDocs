import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import { syntaxHighlighting, HighlightStyle, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { safeExternalUrl } from '../utils'

// Open a link in a new tab only if it uses a safe http/https scheme.
// Returns true when the link was opened so the caller can preventDefault.
function openExternal(rawUrl: string): boolean {
  const url = safeExternalUrl(rawUrl)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.5em', fontWeight: '700', color: '#ffffff', lineHeight: '1.4' },
  { tag: tags.heading2, fontSize: '1.25em', fontWeight: '700', color: '#e8e8e8' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '700', color: '#d8d8d8' },
  { tag: tags.strong, fontWeight: '700', color: '#ffffff' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#cccccc' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#666666' },
  { tag: tags.monospace, fontFamily: 'monospace', color: '#b8b8ff', fontSize: '0.9em' },
  { tag: tags.link, color: '#4a9eff', textDecoration: 'underline' },
  { tag: tags.url, color: '#4a9eff' },
  // Dim syntax characters
  { tag: tags.processingInstruction, color: '#3a3a3a' },
  { tag: tags.meta, color: '#3a3a3a' },
  { tag: tags.punctuation, color: '#3d3d3d' },
])

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', lineHeight: '1.7' },
  '.cm-scroller': { fontFamily: 'ui-monospace, monospace', overflow: 'auto', padding: '24px 32px' },
  '.cm-content': { caretColor: '#4a9eff', minHeight: '100%' },
  '.cm-cursor': { borderLeftColor: '#4a9eff' },
  '.cm-selectionBackground, ::selection': { background: '#264f78 !important' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#4a9eff' },
}, { dark: true })

interface Props {
  content: string
  onChange: (content: string) => void
}

export default function Editor({ content, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange  // always latest, even after re-renders

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ extensions: [GFM] }),
          syntaxHighlighting(markdownHighlight),
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
          EditorView.domEventHandlers({
            click(event, view) {
              if (!event.ctrlKey && !event.metaKey) return false
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
              if (pos === null) return false
              let node = syntaxTree(view.state).resolveInner(pos, 1)
              while (node) {
                if (node.name === 'URL') {
                  // [text](url) — URL child node
                  const url = view.state.sliceDoc(node.from, node.to)
                  if (openExternal(url)) { event.preventDefault(); return true }
                }
                if (node.name === 'Autolink') {
                  // <https://...> — strip surrounding < >
                  const url = view.state.sliceDoc(node.from + 1, node.to - 1)
                  if (openExternal(url)) { event.preventDefault(); return true }
                }
                if (node.name === 'Link') {
                  // Try URL child first ([text](url) form, clicking the text part)
                  const urlChild = node.getChild('URL')
                  if (urlChild) {
                    const url = view.state.sliceDoc(urlChild.from, urlChild.to)
                    if (openExternal(url)) { event.preventDefault(); return true }
                  }
                  // GFM bare URL — the Link node itself is the URL
                  const text = view.state.sliceDoc(node.from, node.to)
                  if (openExternal(text)) { event.preventDefault(); return true }
                }
                if (!node.parent) break
                node = node.parent
              }

              // Fallback: regex scan the line for plain URLs
              const line = view.state.doc.lineAt(pos)
              const offset = pos - line.from
              const urlRe = /https?:\/\/[^\s)>\]"']+/g
              let m
              while ((m = urlRe.exec(line.text)) !== null) {
                if (m.index <= offset && offset <= m.index + m[0].length) {
                  if (openExternal(m[0])) { event.preventDefault(); return true }
                }
              }
              return false
            },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    view.focus()

    return () => view.destroy()
  }, []) // Mount once; content swapped via key prop in App

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#141414' }}
    />
  )
}
