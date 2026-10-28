import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MAX_TRAVELERS, tripSchema, type Trip } from './travel-model'
export default function TravelMembers({
  trip,
  onUpdate,
}: {
  trip: Trip
  onUpdate: (trip: Trip) => boolean | void
}) {
  const [open, setOpen] = useState(false)
  const initial = () =>
    trip.members?.map((member) => ({ ...member })) ||
    Array.from({ length: trip.travelers }, (_, index) => ({
      id: crypto.randomUUID(),
      name: index === 0 ? '나' : `동행 ${index}`,
    }))
  const [members, setMembers] = useState(initial),
    [error, setError] = useState('')
  const referenced = (id: string) =>
    (trip.expenses || []).some(
      (item) =>
        item.payerId === id ||
        item.splits?.some((split) => split.memberId === id),
    ) ||
    (trip.checklist || []).some((item) => item.assigneeId === id) ||
    (trip.settlementPayments || []).some(
      (item) => item.from === id || item.to === id,
    )
  return (
    <div className="member-settings">
      <div className="tool-heading">
        <h4>동행인</h4>
        <button
          className="button outline small"
          onClick={() => {
            setMembers(initial())
            setError('')
            setOpen(!open)
          }}
        >
          {trip.members?.length ? '동행인 편집' : '동행인 등록'}
        </button>
      </div>
      {!open && (
        <div className="member-chips">
          {trip.members?.map((member) => (
            <span key={member.id}>{member.name}</span>
          ))}
        </div>
      )}
      {open && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            const next = {
              ...trip,
              members: members.map((member) => ({
                ...member,
                name: member.name.trim(),
              })),
              travelers: members.length,
            }
            const parsed = tripSchema.safeParse(next)
            if (!parsed.success)
              return setError('동행인 이름은 비우거나 중복할 수 없어요.')
            if (onUpdate(next) === false) return
            setOpen(false)
            setError('')
          }}
        >
          {members.map((member, index) => (
            <div className="member-edit-row" key={member.id}>
              <label className="field">
                동행인 이름 {index + 1}
                <input
                  required
                  maxLength={80}
                  value={member.name}
                  onChange={(event) =>
                    setMembers(
                      members.map((current) =>
                        current.id === member.id
                          ? { ...current, name: event.target.value }
                          : current,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label={`${member.name} 동행인 삭제`}
                disabled={
                  index === 0 || members.length === 1 || referenced(member.id)
                }
                onClick={() =>
                  setMembers(
                    members.filter((current) => current.id !== member.id),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="text-button"
            type="button"
            disabled={members.length >= MAX_TRAVELERS}
            onClick={() =>
              setMembers([...members, { id: crypto.randomUUID(), name: '' }])
            }
          >
            <Plus size={16} />
            동행인 추가
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-row">
            <button
              className="button outline"
              type="button"
              onClick={() => setOpen(false)}
            >
              취소
            </button>
            <button className="button primary" type="submit">
              동행인 저장
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
