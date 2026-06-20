interface Props {
  content: string
  onChange: (content: string) => void
}

export default function Editor({ content, onChange }: Props) {
  return (
    <textarea
      style={{ flex: 1, background: '#141414', color: '#ccc', border: 'none', padding: 16 }}
      value={content}
      onChange={e => onChange(e.target.value)}
    />
  )
}
