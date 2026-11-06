import {
  emptySyncSnapshot,
  stableJson,
  syncSnapshotSchema,
  type SyncSnapshot,
} from './sync-model'
import { tripSchema } from './travel-model'

export type SyncConflict = {
  key: string
  path: string[]
  local: unknown
  remote: unknown
}
export type SyncChoices = Record<string, 'local' | 'remote'>
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)
// Deletion is a change relative to a common base, never absence = "not synced".
export function mergeSyncSnapshots(
  base: SyncSnapshot | undefined,
  local: SyncSnapshot,
  remote: SyncSnapshot,
  choices: SyncChoices = {},
) {
  const conflicts: SyncConflict[] = []
  function conflict(path: string[], l: unknown, r: unknown) {
    const key = JSON.stringify(path)
    if (choices[key]) return choices[key] === 'local' ? l : r
    conflicts.push({ key, path, local: l, remote: r })
    return l
  }
  function merge(b: unknown, l: unknown, r: unknown, path: string[]): unknown {
    if (same(l, r) || same(r, b)) return l
    if (same(l, b)) return r
    if (l === undefined || r === undefined) return conflict(path, l, r)
    if (object(l) && object(r) && (b === undefined || object(b))) {
      if (
        path[0] === 'store' &&
        path[1] === 'trips' &&
        path.length === 3 &&
        object(b) &&
        (l.startDate !== b.startDate ||
          r.startDate !== b.startDate ||
          l.endDate !== b.endDate ||
          r.endDate !== b.endDate)
      )
        return conflict(path, l, r)
      const out = Object.create(null) as Record<string, unknown>
      for (const key of new Set([
        ...Object.keys(object(b) ? b : {}),
        ...Object.keys(l),
        ...Object.keys(r),
      ])) {
        const value = merge(object(b) ? b[key] : undefined, l[key], r[key], [
          ...path,
          key,
        ])
        if (value !== undefined) out[key] = value
      }
      if (
        path[0] === 'store' &&
        path[1] === 'trips' &&
        path.length === 3 &&
        !tripSchema.safeParse(out).success
      ) {
        for (let i = conflicts.length - 1; i >= 0; i--)
          if (conflicts[i].path.slice(0, 3).join('/') === path.join('/'))
            conflicts.splice(i, 1)
        return conflict(path, l, r)
      }
      return out
    }
    if (
      Array.isArray(l) &&
      Array.isArray(r) &&
      (b === undefined || Array.isArray(b))
    ) {
      const previous = Array.isArray(b) ? b : []
      const all = [...previous, ...l, ...r]
      if (
        all.every((v) => typeof v === 'string') &&
        [previous, l, r].every((a) => new Set(a).size === a.length)
      ) {
        const before = new Set(previous),
          left = new Set(l),
          right = new Set(r)
        return [...new Set([...l, ...r])].filter((id) =>
          before.has(id)
            ? left.has(id) && right.has(id)
            : left.has(id) || right.has(id),
        )
      }
      if (
        all.every((v) => object(v) && typeof v.id === 'string') &&
        [previous, l, r].every(
          (a) => new Set(a.map((v) => v.id)).size === a.length,
        )
      ) {
        const keys = [
          ...new Set([...l, ...r, ...previous].map((v) => v.id as string)),
        ]
        const merged = new Map<string, unknown>()
        for (const id of keys) {
          const value = merge(
            previous.find((v) => v.id === id),
            l.find((v) => v.id === id),
            r.find((v) => v.id === id),
            [...path, id],
          )
          if (value !== undefined) merged.set(id, value)
        }
        const baseIds = previous
            .map((v) => v.id)
            .filter((id) => merged.has(id)),
          common = new Set(baseIds)
        const leftOrder = l.map((v) => v.id).filter((id) => common.has(id)),
          rightOrder = r.map((v) => v.id).filter((id) => common.has(id))
        const leftBase = baseIds.filter((id) => leftOrder.includes(id)),
          rightBase = baseIds.filter((id) => rightOrder.includes(id))
        let order: string[] = !same(rightOrder, rightBase)
          ? rightOrder
          : leftOrder
        if (
          !same(leftOrder, leftBase) &&
          !same(rightOrder, rightBase) &&
          !same(leftOrder, rightOrder)
        ) {
          const chosen = conflict(
            [...path, '$order'],
            l.map((v) => v.id),
            r.map((v) => v.id),
          ) as string[]
          order = chosen.filter((id) => merged.has(id))
        }
        order = [...order]
        for (const items of [l, r, previous])
          for (let i = 0; i < items.length; i++) {
            const id = items[i].id as string
            if (!merged.has(id) || order.includes(id)) continue
            const prev = items
              .slice(0, i)
              .reverse()
              .find((v) => order.includes(v.id))?.id
            const next = items
              .slice(i + 1)
              .find((v) => order.includes(v.id))?.id
            order.splice(
              prev
                ? order.indexOf(prev) + 1
                : next
                  ? order.indexOf(next)
                  : order.length,
              0,
              id,
            )
          }
        return order.map((id) => merged.get(id))
      }
      if (
        path.at(-1) === 'days' &&
        previous.length === l.length &&
        l.length === r.length
      )
        return l.map((v, i) =>
          merge(previous[i], v, r[i], [...path, String(i)]),
        )
      return conflict(path, l, r)
    }
    return conflict(path, l, r)
  }
  const result = merge(
    base || emptySyncSnapshot(),
    local,
    remote,
    [],
  ) as SyncSnapshot
  if (!conflicts.length) syncSnapshotSchema.parse(result)
  return { snapshot: result, conflicts }
}
