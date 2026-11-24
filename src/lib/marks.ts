import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { EntrySource, MarkValue } from './types'

export interface SaveMarkInput {
  termId: string
  year: number
  classId: string
  studentId: string
  subject: string
  /** The value currently stored, or null if there is none. Must match the database or the save is refused. */
  oldValue: MarkValue
  newValue: MarkValue
  /** Whether the student's results document already exists. */
  resultExists: boolean
  by: { uid: string; name: string }
  source?: EntrySource
  reason?: string
}

export const resultIdFor = (termId: string, studentId: string) => `${termId}_${studentId}`

/**
 * Save one mark and its change-log entry together. The security rules refuse a mark change
 * that does not arrive with a matching log entry, so the two always succeed or fail together.
 */
export async function saveMark(db: Firestore, input: SaveMarkInput): Promise<string> {
  const resultId = resultIdFor(input.termId, input.studentId)
  const resultRef = doc(db, 'results', resultId)
  const auditRef = doc(collection(db, 'auditLog'))
  const batch = writeBatch(db)

  if (input.resultExists) {
    batch.update(resultRef, {
      [`marks.${input.subject}`]: input.newValue,
      lastAuditId: auditRef.id,
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.set(resultRef, {
      termId: input.termId,
      year: input.year,
      classId: input.classId,
      studentId: input.studentId,
      marks: { [input.subject]: input.newValue },
      lastAuditId: auditRef.id,
      updatedAt: serverTimestamp(),
    })
  }

  batch.set(auditRef, {
    resultId,
    termId: input.termId,
    classId: input.classId,
    studentId: input.studentId,
    subject: input.subject,
    old: input.resultExists ? input.oldValue : null,
    new: input.newValue,
    by: input.by.uid,
    byName: input.by.name,
    at: serverTimestamp(),
    source: input.source ?? 'typed',
    reason: input.reason ?? '',
  })

  await batch.commit()
  return auditRef.id
}
