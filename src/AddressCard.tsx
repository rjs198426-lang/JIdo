import { useEffect, useRef, useState } from 'react'
import { Copy, X } from 'lucide-react'

export default function AddressCard({
  name,
  address,
}: {
  name: string
  address: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="button outline small address-open"
        onClick={() => setOpen(true)}
      >
        주소 크게 보기
      </button>
      {open && (
        <AddressDialog
          name={name}
          address={address}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
function AddressDialog({
  name,
  address,
  onClose,
}: {
  name: string
  address: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      className="address-dialog"
      ref={dialog}
      aria-label="보여줄 주소"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="address-heading">
        <h3>목적지 주소</h3>
        <button
          className="icon-button"
          aria-label="주소 화면 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <h2>{name}</h2>
      <p className="address-display" dir="auto">
        {address}
      </p>
      <button
        className="button primary full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${name}\n${address}`)
            setMessage('주소를 복사했어요.')
          } catch {
            setMessage('복사하지 못했어요. 주소를 길게 눌러 선택하세요.')
          }
        }}
      >
        <Copy size={18} />
        주소 복사
      </button>
      {message && <p role="status">{message}</p>}
    </dialog>
  )
}
