import { useEffect, useRef, useState } from 'react'
import { checkStoredAttachment } from './attachment-storage'
import type { Attachment } from './attachment-schema'
type Check = { id: string; name: string; error?: string }
export default function AttachmentCheck({ files }: { files: Attachment[] }) {
  const alive = useRef(true),
    running = useRef(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [result, setResult] = useState<{ key: string; checks: Check[] }>()
  const key = files
    .map((file) => `${file.id}:${file.storage}:${file.size}`)
    .join('|')
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  if (!files.length) return null
  const checks = result?.key === key ? result.checks : undefined,
    failed = checks?.filter((item) => item.error) || []
  return (
    <section className="attachment-check" aria-label="기기 자료 확인">
      <button
        className="button outline small"
        disabled={busy}
        onClick={async () => {
          if (running.current) return
          running.current = true
          setBusy(true)
          setProgress(0)
          setResult(undefined)
          const next: Check[] = []
          try {
            for (const file of files) {
              if (!alive.current) return
              try {
                await checkStoredAttachment(file)
                next.push({ id: file.id, name: file.name })
              } catch (reason) {
                next.push({
                  id: file.id,
                  name: file.name,
                  error:
                    (reason as Error).message || '자료를 확인할 수 없어요.',
                })
              }
              if (alive.current) setProgress(next.length)
            }
            if (alive.current) setResult({ key, checks: next })
          } finally {
            running.current = false
            if (alive.current) setBusy(false)
          }
        }}
      >
        {busy ? `확인 중 ${progress}/${files.length}` : '기기 자료 확인'}
      </button>
      {checks && (
        <p role="status">
          파일 존재·크기 확인 {checks.length - failed.length}/{checks.length}개
          {failed.length ? ` · 확인 필요 ${failed.length}개` : ''}
        </p>
      )}
      {result && !checks && (
        <p role="status">자료 목록이 바뀌었어요. 다시 확인하세요.</p>
      )}
      {!!failed.length && (
        <ul className="attachment-check-errors">
          {failed.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.error}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
