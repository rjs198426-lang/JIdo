// A shared restored photo can belong to both a trip and a personal cover.
// On unreadable storage, retain bytes rather than risk deleting someone's file.
export function savedTripReferencesFile(id: string): boolean {
  try {
    const data = JSON.parse(localStorage.getItem('jido-travel-v1') || 'null')
    if (!data) return false
    if (!Array.isArray(data.trips)) return true
    return data.trips.some(
      (trip: {
        attachments?: { id: string }[]
        days?: { photoId?: string }[][]
      }) =>
        trip.attachments?.some((file) => file.id === id) ||
        trip.days?.some((day) => day.some((stop) => stop.photoId === id)),
    )
  } catch {
    return true
  }
}
