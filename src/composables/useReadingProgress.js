/**
 * Reading Progress Tracker
 * Tracks which reading items are completed
 * Replaces useAliyahNavigation.ts with flexible approach support
 */

import { ref, computed, watch } from 'vue'
import { useSettings } from './useSettings'

const STORAGE_KEY = 'shnayim-reading-progress-v2'
const OLD_STORAGE_KEY = 'shnayim-aliyah-progress'
const STORAGE_VERSION = 2

export function useReadingProgress() {
  const { settings } = useSettings()
  const progressState = ref({})
  const currentParsha = ref('')
  const allReadingItems = ref([])
  const completionFeedback = ref({ isVisible: false, itemId: null })

  /**
   * Load progress state from localStorage with migration support
   */
  function loadProgressState() {
    try {
      // Try new format first
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version === STORAGE_VERSION) {
          return parsed.state || {}
        }
      }

      // Try old format and migrate
      const oldStored = localStorage.getItem(OLD_STORAGE_KEY)
      if (oldStored) {
        console.log('Migrating old progress format...')
        const oldParsed = JSON.parse(oldStored)
        const migratedState = migrateOldProgress(oldParsed.state || {})
        return migratedState
      }

      return {}
    } catch (e) {
      console.warn('Failed to load reading progress:', e)
      return {}
    }
  }

  /**
   * Migrate old aliyah-based progress to new reading-item-based format
   */
  function migrateOldProgress(oldState) {
    const migratedState = {}

    for (const [parsha, parshaProgress] of Object.entries(oldState)) {
      // Convert old aliyah phases to reading items
      // For now, just reset on migration - user will start fresh
      // In future, could map phases to item IDs if we keep backward compatibility
      migratedState[parsha] = {
        date: new Date().toISOString().split('T')[0],
        approach: 'pasuk',
        currentItemId: null,
        completedItemIds: []
      }
    }

    return migratedState
  }

  /**
   * Save progress state to localStorage
   */
  function saveProgressState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          state: progressState.value
        })
      )
    } catch (e) {
      console.warn('Failed to save reading progress:', e)
    }
  }

  /**
   * Initialize progress for a parsha
   */
  function initializeParsha(parsha, readingItems, approach = 'pasuk') {
    currentParsha.value = parsha
    allReadingItems.value = readingItems

    if (!progressState.value[parsha]) {
      progressState.value[parsha] = {
        date: getTodayDateString(),
        approach,
        currentItemId: readingItems[0]?.id || null,
        completedItemIds: []
      }
    } else {
      // Check for approach change
      if (progressState.value[parsha].approach !== approach) {
        // Reset if approach changed
        progressState.value[parsha] = {
          date: getTodayDateString(),
          approach,
          currentItemId: readingItems[0]?.id || null,
          completedItemIds: []
        }
      } else {
        // Check if it's a new day - reset if so
        const lastDate = progressState.value[parsha].date
        const today = getTodayDateString()
        if (lastDate !== today) {
          progressState.value[parsha] = {
            date: today,
            approach,
            currentItemId: readingItems[0]?.id || null,
            completedItemIds: []
          }
        }
      }
    }

    saveProgressState()
  }

  /**
   * Get current reading item
   */
  function getCurrentItem() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return null
    }

    const currentId = progressState.value[currentParsha.value].currentItemId
    return allReadingItems.value.find((item) => item.id === currentId)
  }

  /**
   * Get current item ID
   */
  function getCurrentItemId() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return null
    }
    return progressState.value[currentParsha.value].currentItemId
  }

  /**
   * Check if an item is completed
   */
  function isItemCompleted(itemId) {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return false
    }

    const completed = progressState.value[currentParsha.value].completedItemIds
    return completed.includes(itemId)
  }

  /**
   * Mark current item as complete and advance to next
   */
  function completeCurrentItem() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentItem()
    if (!current) return

    const completed = progressState.value[currentParsha.value].completedItemIds

    // Add to completed if not already there
    if (!completed.includes(current.id)) {
      completed.push(current.id)
    }

    // Show feedback
    showCompletionFeedback(current.id)

    saveProgressState()

    // Auto-advance after delay based on animation speed setting
    const delay = getAnimationDelay()
    setTimeout(() => {
      advanceToNextItem()
    }, delay)
  }

  /**
   * Advance to next reading item
   */
  function advanceToNextItem() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const currentIdx = allReadingItems.value.findIndex(
      (i) => i.id === progressState.value[currentParsha.value].currentItemId
    )

    if (currentIdx >= 0 && currentIdx < allReadingItems.value.length - 1) {
      const nextItem = allReadingItems.value[currentIdx + 1]
      progressState.value[currentParsha.value].currentItemId = nextItem.id
      scrollToItem(nextItem.id)
    }

    saveProgressState()
  }

  /**
   * Jump to a specific item by ID
   */
  function jumpToItem(itemId) {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    progressState.value[currentParsha.value].currentItemId = itemId
    scrollToItem(itemId)
    saveProgressState()
  }

  /**
   * Jump to a specific item by index
   */
  function jumpToItemIndex(index) {
    if (index >= 0 && index < allReadingItems.value.length) {
      const item = allReadingItems.value[index]
      jumpToItem(item.id)
    }
  }

  /**
   * Jump to first item of a specific aliyah
   */
  function jumpToAliyah(aliyahNum) {
    const firstItemInAliyah = allReadingItems.value.find((i) => i.aliyahNum === aliyahNum)
    if (firstItemInAliyah) {
      jumpToItem(firstItemInAliyah.id)
    }
  }

  /**
   * Scroll reading item into view
   */
  function scrollToItem(itemId) {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const selector = `[data-item-id="${itemId}"]`
      const element = document.querySelector(selector)

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }

  /**
   * Get animation delay based on settings
   */
  function getAnimationDelay() {
    const speedMap = {
      fast: 300,
      normal: 500,
      slow: 800
    }

    const speed = settings.value?.animationSpeed || 'normal'
    return speedMap[speed] || 500
  }

  /**
   * Show completion feedback animation
   */
  function showCompletionFeedback(itemId) {
    completionFeedback.value = {
      isVisible: true,
      itemId
    }

    // Hide after animation
    setTimeout(() => {
      completionFeedback.value = {
        isVisible: false,
        itemId: null
      }
    }, 400)
  }

  /**
   * Get progress statistics
   */
  function getProgressStats() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return {
        completed: 0,
        total: 0,
        percentComplete: 0,
        remaining: 0
      }
    }

    const completed = progressState.value[currentParsha.value].completedItemIds.length
    const total = allReadingItems.value.length
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0
    const remaining = total - completed

    return {
      completed,
      total,
      percentComplete,
      remaining
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
      approach: progressState.value[currentParsha.value].approach,
      currentItemId: allReadingItems.value[0]?.id || null,
      completedItemIds: []
    }

    saveProgressState()
  }

  /**
   * Get today's date string in YYYY-MM-DD format
   */
  function getTodayDateString() {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  /**
   * Handle spacebar key press
   */
  function handleSpacebarPress(event) {
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault()
      completeCurrentItem()
    }
  }

  /**
   * Get next item
   */
  function getNextItem() {
    const current = getCurrentItem()
    if (!current) return null

    const currentIdx = allReadingItems.value.findIndex((i) => i.id === current.id)
    if (currentIdx >= 0 && currentIdx < allReadingItems.value.length - 1) {
      return allReadingItems.value[currentIdx + 1]
    }
    return null
  }

  /**
   * Get previous item
   */
  function getPreviousItem() {
    const current = getCurrentItem()
    if (!current) return null

    const currentIdx = allReadingItems.value.findIndex((i) => i.id === current.id)
    if (currentIdx > 0) {
      return allReadingItems.value[currentIdx - 1]
    }
    return null
  }

  /**
   * Check if all items are completed
   */
  function isAllComplete() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return false
    }

    const completed = progressState.value[currentParsha.value].completedItemIds
    return completed.length === allReadingItems.value.length && allReadingItems.value.length > 0
  }

  // Auto-save on state changes
  watch(progressState, saveProgressState, { deep: true })

  // Initialize on first load
  progressState.value = loadProgressState()

  return {
    // State
    currentItem: computed(() => getCurrentItem()),
    currentItemId: computed(() => getCurrentItemId()),
    completionFeedback: computed(() => completionFeedback.value),
    progressStats: computed(() => getProgressStats()),
    isAllComplete: computed(() => isAllComplete()),
    readingItems: computed(() => allReadingItems.value),

    // Methods
    initializeParsha,
    getCurrentItem,
    getCurrentItemId,
    isItemCompleted,
    completeCurrentItem,
    advanceToNextItem,
    jumpToItem,
    jumpToItemIndex,
    jumpToAliyah,
    getNextItem,
    getPreviousItem,
    getProgressStats,
    resetProgress,
    handleSpacebarPress
  }
}
