import { useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { checklistCategories, checklistSchema, type Trip } from './travel-model'
import { today, formatDate } from './store'

type Item = NonNullable<Trip['checklist']>[number]
const basic: [string, (typeof checklistCategories)[number]][] = [
  ['여권 유효기간 확인', '서류'],
  ['비자·입국 조건 확인', '서류'],
  ['항공편·숙소 예약 확인', '예약'],
  ['여행자 보험 준비', '서류'],
  ['eSIM·로밍 준비', '통신·환전'],
  ['환전·해외 결제 카드 확인', '통신·환전'],
  ['충전기·어댑터 챙기기', '짐'],
  ['상비약 챙기기', '짐'],
]
const templates: Record<string, typeof basic> = {
  '기본 여행': basic,
  '가족 여행': [
    ...basic,
    ['아이 신분증·가족관계 서류 확인', '서류'],
    ['유모차·카시트 예약 확인', '예약'],
    ['아이 간식·여벌옷 챙기기', '짐'],
    ['동행 가족 약 챙기기', '짐'],
  ],
  '휴양 여행': [
    ...basic,
    ['수영복·아쿠아슈즈 챙기기', '짐'],
    ['자외선 차단제·모자 챙기기', '짐'],
    ['해양 체험 예약 확인', '예약'],
  ],
  '배낭 여행': [
    ...basic,
    ['배낭 무게·수하물 규정 확인', '짐'],
    ['오프라인 지도 내려받기', '기타'],
    ['야간 이동편·교통패스 확인', '예약'],
    ['보조 배터리·자물쇠 챙기기', '짐'],
  ],
}
export default function PreparationChecklist({
  trip,
  onUpdate,
}: {
  trip: Trip
  onUpdate: (trip: Trip) => void
}) {
  const items = trip.checklist || []
  const [title, setTitle] = useState(''),
    [category, setCategory] = useState<Item['category']>('기타'),
    [template, setTemplate] = useState('기본 여행'),
    [filter, setFilter] = useState('전체'),
    [categoryFilter, setCategoryFilter] = useState('전체'),
    [assigneeFilter, setAssigneeFilter] = useState('all'),
    [addAssignee, setAddAssignee] = useState('')
  const [editing, setEditing] = useState<Item | null>(null),
    [removed, setRemoved] = useState<{ item: Item; index: number } | null>(
      null,
    ),
    [error, setError] = useState('')
  const done = items.filter((item) => item.done).length
  const overdue = (item: Item) =>
    !item.done && !!item.dueDate && item.dueDate < today()
  function add(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    if (items.length >= 500)
      return setError('준비 항목은 최대 500개까지 저장할 수 있어요.')
    onUpdate({
      ...trip,
      checklist: [
        ...items,
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          done: false,
          category,
          assigneeId: addAssignee || undefined,
        },
      ],
    })
    setTitle('')
    setError('')
  }
  const visible = items.filter(
    (item) =>
      (assigneeFilter === 'all' ||
        (assigneeFilter === 'shared'
          ? !item.assigneeId
          : item.assigneeId === assigneeFilter)) &&
      (categoryFilter === '전체' ||
        (item.category || '기타') === categoryFilter) &&
      (filter === '전체' ||
        (filter === '미완료' && !item.done) ||
        (filter === '완료' && item.done) ||
        (filter === '기한 지남' && overdue(item))),
  )
  return (
    <section className="workspace-panel">
      <div className="tool-heading">
        <h3>여행 준비물</h3>
        <strong>
          {done}/{items.length} 완료
        </strong>
      </div>
      <progress
        value={done}
        max={items.length || 1}
        aria-label="여행 준비 진행률"
        className="wide-progress"
      />
      <form className="quick-add" onSubmit={add}>
        <input
          aria-label="새 준비물"
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="할 일이나 챙길 물건"
        />
        <select
          aria-label="준비물 분류"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as Item['category'])
          }
        >
          {checklistCategories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        {!!trip.members?.length && trip.travelers > 1 && (
          <select
            aria-label="추가 항목 담당자"
            value={addAssignee}
            onChange={(event) => setAddAssignee(event.target.value)}
          >
            <option value="">함께 준비</option>
            {trip.members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        )}
        <button className="button primary small" type="submit">
          <Plus size={16} />
          추가
        </button>
      </form>
      <div className="template-row">
        <select
          aria-label="준비 목록 유형"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        >
          {Object.keys(templates).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button
          className="text-button"
          onClick={() => {
            const added = templates[template]
              .filter(
                ([title]) =>
                  !items.some(
                    (item) =>
                      item.title === title &&
                      (item.assigneeId || '') === addAssignee,
                  ),
              )
              .map(([title, category]) => ({
                id: crypto.randomUUID(),
                title,
                category,
                assigneeId: addAssignee || undefined,
                done: false,
              }))
            if (items.length + added.length > 500)
              return setError('준비 항목은 최대 500개까지 저장할 수 있어요.')
            onUpdate({ ...trip, checklist: [...items, ...added] })
            setError('')
          }}
        >
          {template} 준비 목록 넣기 <Plus size={15} />
        </button>
      </div>
      <div className="tool-filters">
        {trip.travelers > 1 && !!trip.members?.length && (
          <select
            aria-label="준비 담당자 필터"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="all">모두의 준비물</option>
            <option value="shared">함께 준비</option>
            {trip.members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}의 준비물
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="준비 상태 필터"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {['전체', '미완료', '완료', '기한 지남'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="준비 분류 필터"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          {['전체', ...checklistCategories].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      {editing && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            const parsed = checklistSchema.safeParse(editing)
            if (!parsed.success)
              return setError('준비물 이름과 날짜를 확인하세요.')
            onUpdate({
              ...trip,
              checklist: items.map((item) =>
                item.id === editing.id ? parsed.data : item,
              ),
            })
            setEditing(null)
            setError('')
          }}
        >
          <label className="field">
            준비물 이름
            <input
              required
              maxLength={160}
              value={editing.title}
              onChange={(event) =>
                setEditing({ ...editing, title: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label className="field">
              준비물 기한
              <input
                type="date"
                value={editing.dueDate || ''}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    dueDate: event.target.value || undefined,
                  })
                }
              />
            </label>
            <label className="field">
              준비물 담당자
              <select
                value={editing.assigneeId || ''}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    assigneeId: event.target.value || undefined,
                  })
                }
              >
                <option value="">지정 안 함</option>
                {trip.members?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            준비물 메모
            <textarea
              maxLength={500}
              value={editing.note || ''}
              onChange={(event) =>
                setEditing({ ...editing, note: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <button
              className="button outline"
              type="button"
              onClick={() => setEditing(null)}
            >
              취소
            </button>
            <button className="button primary" type="submit">
              준비물 수정 저장
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!visible.length && (
        <p className="workspace-empty">
          {items.length
            ? '이 조건에 맞는 항목이 없어요.'
            : '준비할 항목을 추가하세요.'}
        </p>
      )}
      <div className="checklist">
        {visible.map((item) => (
          <div key={item.id} className="checklist-row">
            <div>
              <label className={item.done ? 'done' : ''}>
                <input
                  aria-label={item.title}
                  type="checkbox"
                  checked={item.done}
                  onChange={() =>
                    onUpdate({
                      ...trip,
                      checklist: items.map((current) =>
                        current.id === item.id
                          ? { ...current, done: !current.done }
                          : current,
                      ),
                    })
                  }
                />
                <span>{item.title}</span>
              </label>
              <small className={overdue(item) ? 'over-budget' : ''}>
                {item.category || '기타'}
                {item.dueDate
                  ? ` · ${formatDate(item.dueDate)}${overdue(item) ? ' 기한 지남' : ''}`
                  : ''}
                {item.assigneeId
                  ? ` · ${trip.members?.find((member) => member.id === item.assigneeId)?.name || ''}`
                  : ''}
              </small>
              {item.note && <p>{item.note}</p>}
            </div>
            <div className="row-actions">
              <button
                className="icon-button"
                aria-label={`${item.title} 준비물 수정`}
                onClick={() => {
                  setEditing(item)
                  setError('')
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={`${item.title} 준비물 삭제`}
                onClick={() => {
                  setRemoved({
                    item,
                    index: items.findIndex((current) => current.id === item.id),
                  })
                  onUpdate({
                    ...trip,
                    checklist: items.filter(
                      (current) => current.id !== item.id,
                    ),
                  })
                  if (editing?.id === item.id) setEditing(null)
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {removed && (
        <div className="undo-strip" role="status">
          준비물을 삭제했어요.
          <button
            onClick={() => {
              onUpdate({
                ...trip,
                checklist: [
                  ...items.slice(0, removed.index),
                  removed.item,
                  ...items.slice(removed.index),
                ],
              })
              setRemoved(null)
            }}
          >
            실행 취소
          </button>
        </div>
      )}
    </section>
  )
}
