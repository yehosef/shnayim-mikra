/**
 * Verse Navigation Composable
 * Manages current verse position, completion tracking, and auto-advance
 */

import { ref, computed, watch } from 'vue'
import type { VersePosition, VerseProgressState, CompletionFeedback } from '@/types/verseProgress'

const STORAGE_KEY = 'shnayim-verse-progress'
const STORAGE_STATE_VERSION = 1

export function useVerseNavigation() {
  // State
  const progressState = ref<VerseProgressState>(loadProgressState())
  const currentParsha = ref<string>('')
  const completionFeedback = ref<CompletionFeedback>({
    isVisible: false,
    position: null
  })

  /**
   * Load progress state from localStorage
   */
  function loadProgressState(): VerseProgressState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}

      const parsed = JSON.parse(stored)
      return parsed.state || {}
    } catch (e) {
      console.warn('Failed to load progress state:', e)
      return {}
    }
  }

  /**
   * Save progress state to localStorage
   */
  function saveProgressState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_STATE_VERSION,
        state: progressState.value
      }))
    } catch (e) {
      console.warn('Failed to save progress state:', e)
    }
  }

  /**
   * Initialize or get progress for current parsha
   */
  function initializeParsha(parsha: string, totalVerses: number) {
    currentParsha.value = parsha

    if (!progressState.value[parsha]) {
      progressState.value[parsha] = {
        date: getTodayDateString(),
        currentPosition: { perek: 0, pasuk: 0 },
        completedPositions: []
      }
    } else {
      // Check if it's a new day - if so, reset progress
      const lastDate = progressState.value[parsha].date
      const today = getTodayDateString()
      if (lastDate !== today) {
        progressState.value[parsha] = {
          date: today,
          currentPosition: { perek: 0, pasuk: 0 },
          completedPositions: []
        }
      }
    }

    saveProgressState()
  }

  /**
   * Get current position for the active parsha
   */
  function getCurrentPosition(): VersePosition | null {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return null
    }
    return progressState.value[currentParsha.value].currentPosition
  }

  /**
   * Set current position
   */
  function setCurrentPosition(position: VersePosition | null) {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }
    progressState.value[currentParsha.value].currentPosition = position
    saveProgressState()
  }

  /**
   * Check if a verse is completed
   */
  function isVerseCompleted(perek: number, pasuk: number): boolean {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return false
    }

    const completed = progressState.value[currentParsha.value].completedPositions
    return completed.some(v => v.perek === perek && v.pasuk === pasuk)
  }

  /**
   * Mark current verse as complete and advance to next
   */
  function completeCurrentVerse() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    const completed = progressState.value[currentParsha.value].completedPositions

    // Don't add if already completed
    if (!isVerseCompleted(current.perek, current.pasuk)) {
      completed.push({ perek: current.perek, pasuk: current.pasuk })
    }

    // Show feedback
    showCompletionFeedback(current)

    saveProgressState()

    // Auto-advance after delay
    setTimeout(() => {
      advanceToNextVerse()
    }, 600) // 600ms delay as per design
  }

  /**
   * Advance to next verse
   */
  function advanceToNextVerse() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    // Calculate next position
    let nextPerek = current.perek
    let nextPasuk = current.pasuk + 1

    // Note: We don't know max verses here, caller should handle bounds checking
    // For now, just increment - the view layer will handle wrapping

    setCurrentPosition({ perek: nextPerek, pasuk: nextPasuk })

    // Scroll the verse into view
    scrollVerseIntoView(nextPerek, nextPasuk)
  }

  /**
   * Jump to specific verse
   */
  function jumpToVerse(perek: number, pasuk: number) {
    setCurrentPosition({ perek, pasuk })
    scrollVerseIntoView(perek, pasuk)
  }

  /**
   * Show completion feedback animation
   */
  function showCompletionFeedback(position: VersePosition) {
    completionFeedback.value = {
      isVisible: true,
      position: { ...position }
    }

    // Hide after animation completes
    setTimeout(() => {
      completionFeedback.value = {
        isVisible: false,
        position: null
      }
    }, 400)
  }

  /**
   * Scroll a specific verse into view
   */
  function scrollVerseIntoView(perek: number, pasuk: number) {
    // Find element by data attributes
    const selector = `[data-perek="${perek}"][data-pasuk="${pasuk}"]`
    const element = document.querySelector(selector)

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  /**
   * Get today's date string in YYYY-MM-DD format
   */
  function getTodayDateString(): string {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  /**
   * Get progress stats for current parsha
   */
  function getProgressStats() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return {
        completed: 0,
        total: 0,
        percentComplete: 0
      }
    }

    const completed = progressState.value[currentParsha.value].completedPositions.length
    // Note: total should come from the parsha definition/verses array

    return {
      completed,
      total: 0, // Set by caller
      percentComplete: 0 // Calculated by caller
    }
  }

  /**
   * Reset progress for current parsha
   */
  function resetProgress() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    progressState.value[currentParsha.value] = {
      date: getTodayDateString(),
      currentPosition: { perek: 0, pasuk: 0 },
      completedPositions: []
    }

    saveProgressState()
  }

  /**
   * Handle spacebar key press
   */
  function handleSpacebarPress(event: KeyboardEvent) {
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault()
      completeCurrentVerse()
    }
  }

  // Auto-save on state changes
  watch(progressState, saveProgressState, { deep: true })

  return {
    // State
    currentPosition: computed(() => getCurrentPosition()),
    completionFeedback: computed(() => completionFeedback.value),
    progressState: computed(() => progressState.value),

    // Methods
    initializeParsha,
    getCurrentPosition,
    setCurrentPosition,
    isVerseCompleted,
    completeCurrentVerse,
    advanceToNextVerse,
    jumpToVerse,
    getProgressStats,
    resetProgress,
    handleSpacebarPress
  }
}
