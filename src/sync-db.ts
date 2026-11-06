function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('jido-drive-sync-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('records')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new Error('동기화 저장소를 열지 못했어요. 기존 여행은 그대로예요.'),
      )
    request.onblocked = () =>
      reject(new Error('다른 앱 화면을 닫고 다시 시도해 주세요.'))
  })
}
export async function syncDb<T>(key: string): Promise<T | undefined> {
  const db = await open()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction('records', 'readonly'),
        r = tx.objectStore('records').get(key)
      tx.oncomplete = () => resolve(r.result)
      tx.onerror = () => reject(new Error('동기화 기록을 읽지 못했어요.'))
    })
  } finally {
    db.close()
  }
}
export async function writeSyncDb(changes: { key: string; value?: unknown }[]) {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'),
        store = tx.objectStore('records')
      for (const change of changes)
        change.value === undefined
          ? store.delete(change.key)
          : store.put(change.value, change.key)
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            '동기화 기록을 저장하지 못했어요. 기기 여유 공간을 확인해 주세요.',
          ),
        )
    })
  } finally {
    db.close()
  }
}
export async function clearSyncAccount(account: string) {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'),
        store = tx.objectStore('records'),
        cursor = store.openCursor()
      cursor.onsuccess = () => {
        const item = cursor.result
        if (item) {
          if (String(item.key).startsWith(account + '/')) item.delete()
          item.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(new Error('연결 기록 정리를 마치지 못했어요.'))
    })
  } finally {
    db.close()
  }
}
export async function cacheSyncCommit(key: string, value: string) {
  const db = await open(),
    prefix = key.split('/commit/')[0] + '/commit/'
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'),
        store = tx.objectStore('records')
      store.put(value, key)
      const keys = store.getAllKeys(
        IDBKeyRange.bound(prefix, prefix + '\uffff'),
      )
      keys.onsuccess = () => {
        const others = keys.result.filter((k) => k !== key)
        for (const old of others.slice(0, Math.max(0, others.length - 63)))
          store.delete(old)
      }
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () =>
        reject(new Error('동기화 캐시 저장에 실패했어요.'))
    })
  } finally {
    db.close()
  }
}
