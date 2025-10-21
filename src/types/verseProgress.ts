/**
 * Verse Progress Tracking Types
 * Tracks which pasuk is currently being studied and which are completed
 */

export interface VersePosition {
  perek: number   // 0-indexed chapter
  pasuk: number   // 0-indexed verse
}

export interface ParshaProgress {
  parsha: string
  date: string    // YYYY-MM-DD format
  currentPosition: VersePosition | null
  completedPositions: VersePosition[]
}

export interface VerseProgressState {
  [parsha: string]: {
    date: string
    currentPosition: VersePosition | null
    completedPositions: VersePosition[]
  }
}

export interface CompletionFeedback {
  isVisible: boolean
  position: VersePosition | null
}
