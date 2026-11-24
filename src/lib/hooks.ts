import { useEffect, useState } from 'react'
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore'

export interface Live<T> {
  data: T
  loading: boolean
  error: string | null
  /** True once the data has been confirmed by the server at least once (not only read from the device's copy). */
  synced: boolean
}

/** Live list of documents for a query. Pass null to wait (for example until an id is known). */
export function useQuery<T>(q: Query | null, deps: unknown[]): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true, error: null, synced: false })
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null, synced: false })
      return
    }
    setState((s) => ({ ...s, loading: true, synced: false }))
    let synced = false
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        synced = synced || !snap.metadata.fromCache
        setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null, synced })
      },
      (err) => setState({ data: [], loading: false, error: err.message, synced: false }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Live single document, or null when it does not exist. */
export function useDoc<T>(ref: DocumentReference | null, deps: unknown[]): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: true, error: null, synced: false })
  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null, synced: false })
      return
    }
    return onSnapshot(
      ref,
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
          loading: false,
          error: null,
          synced: !snap.metadata.fromCache,
        }),
      (err) => setState({ data: null, loading: false, error: err.message, synced: false }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
