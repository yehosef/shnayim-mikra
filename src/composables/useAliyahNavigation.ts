/**
 * Aliyah Navigation Composable
 * Manages Torah study tracking at the aliyah level with three phases:
 * Rishon (first reading), Sheni (second reading), Shlishi (Targum reading)
 */

import { ref, computed, watch } from 'vue'

type Phase = 'rishon' | 'sheni' | 'shlishi'

interface AliyahPosition {
  aliyahNum: number  // 1-7
  phase: Phase
}

interface AliyahData {
  aliya: number
  start: [number, number]  // [perek, pasuk]
  end: [number, number]
  verseCount: number
}

interface AliyahProgressState {
  [parsha: string]: {
    date: string
    currentPosition: AliyahPosition
    completedPhases: AliyahPosition[]
  }
}

interface CompletionFeedback {
  isVisible: boolean
  position: AliyahPosition | null
}

const STORAGE_KEY = 'shnayim-aliyah-progress'
const STORAGE_STATE_VERSION = 1
const PHASE_ORDER: Phase[] = ['rishon', 'sheni', 'shlishi']

// Cache for aliyot data
let aliyotDataCache: Record<string, AliyahData[]> | null = null

export function useAliyahNavigation() {
  // State
  const progressState = ref<AliyahProgressState>(loadProgressState())
  const currentParsha = ref<string>('')
  const aliyotData = ref<AliyahData[]>([])
  const completionFeedback = ref<CompletionFeedback>({
    isVisible: false,
    position: null
  })

  /**
   * Load progress state from localStorage
   */
  function loadProgressState(): AliyahProgressState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}

      const parsed = JSON.parse(stored)
      return parsed.state || {}
    } catch (e) {
      console.warn('Failed to load aliyah progress state:', e)
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
      console.warn('Failed to save aliyah progress state:', e)
    }
  }

  /**
   * Load aliyot data from JSON file
   */
  async function loadAliyotData(parsha: string): Promise<AliyahData[]> {
    try {
      // Check cache first
      if (aliyotDataCache && aliyotDataCache[parsha]) {
        return aliyotDataCache[parsha]
      }

      const response = await fetch('/data/aliyot.json')
      const data = await response.json()

      // Initialize cache if needed
      if (!aliyotDataCache) {
        aliyotDataCache = data
      }

      return data[parsha] || []
    } catch (e) {
      console.error(`Failed to load aliyot data for ${parsha}:`, e)
      return []
    }
  }

  /**
   * Initialize or get progress for current parsha
   */
  async function initializeParsha(parsha: string) {
    currentParsha.value = parsha

    // Load aliyot data
    const data = await loadAliyotData(parsha)
    aliyotData.value = data

    if (!progressState.value[parsha]) {
      progressState.value[parsha] = {
        date: getTodayDateString(),
        currentPosition: { aliyahNum: 1, phase: 'rishon' },
        completedPhases: []
      }
    } else {
      // Check if it's a new day - if so, reset progress
      const lastDate = progressState.value[parsha].date
      const today = getTodayDateString()
      if (lastDate !== today) {
        progressState.value[parsha] = {
          date: today,
          currentPosition: { aliyahNum: 1, phase: 'rishon' },
          completedPhases: []
        }
      }
    }

    saveProgressState()
  }

  /**
   * Get current position for the active parsha
   */
  function getCurrentPosition(): AliyahPosition | null {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return null
    }
    return progressState.value[currentParsha.value].currentPosition
  }

  /**
   * Set current position
   */
  function setCurrentPosition(position: AliyahPosition | null) {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }
    progressState.value[currentParsha.value].currentPosition = position
    saveProgressState()
  }

  /**
   * Check if an aliyah phase is completed
   */
  function isPhaseCompleted(aliyahNum: number, phase: Phase): boolean {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return false
    }

    const completed = progressState.value[currentParsha.value].completedPhases
    return completed.some(p => p.aliyahNum === aliyahNum && p.phase === phase)
  }

  /**
   * Mark current phase as complete and advance to next
   */
  function completeCurrentPhase() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    const completed = progressState.value[currentParsha.value].completedPhases

    // Don't add if already completed
    if (!isPhaseCompleted(current.aliyahNum, current.phase)) {
      completed.push({ aliyahNum: current.aliyahNum, phase: current.phase })
    }

    // Show feedback
    showCompletionFeedback(current)

    saveProgressState()

    // Auto-advance after delay
    setTimeout(() => {
      advanceToNextPhase()
    }, 600) // 600ms delay as per design
  }

  /**
   * Advance to next phase or aliyah
   */
  function advanceToNextPhase() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    let nextAliyahNum = current.aliyahNum
    let nextPhaseIndex = PHASE_ORDER.indexOf(current.phase) + 1

    // If we've completed all phases of this aliyah, move to next aliyah
    if (nextPhaseIndex >= PHASE_ORDER.length) {
      nextAliyahNum++
      nextPhaseIndex = 0

      // If we've completed all aliyot, wrap to first aliyah
      if (nextAliyahNum > aliyotData.value.length) {
        nextAliyahNum = 1
      }
    }

    const nextPhase = PHASE_ORDER[nextPhaseIndex]
    setCurrentPosition({ aliyahNum: nextAliyahNum, phase: nextPhase })

    // Scroll to first verse of current aliyah
    scrollToAliyah(nextAliyahNum)
  }

  /**
   * Get aliyah data for a specific aliyah number
   */
  function getAliyahData(aliyahNum: number): AliyahData | null {
    if (!aliyotData.value || aliyahNum < 1 || aliyahNum > aliyotData.value.length) {
      return null
    }
    return aliyotData.value[aliyahNum - 1]
  }

  /**
   * Check if a verse (perek, pasuk) is in the current aliyah
   */
  function isVerseInCurrentAliyah(perek: number, pasuk: number): boolean {
    const current = getCurrentPosition()
    if (!current) return false

    const aliyahData = getAliyahData(current.aliyahNum)
    if (!aliyahData) return false

    const [startPerek, startPasuk] = aliyahData.start
    const [endPerek, endPasuk] = aliyahData.end

    // Check if verse is within range
    if (perek < startPerek || perek > endPerek) return false
    if (perek === startPerek && pasuk < startPasuk) return false
    if (perek === endPerek && pasuk > endPasuk) return false

    return true
  }

  /**
   * Get current aliyah number
   */
  function getCurrentAliyahNum(): number {
    const current = getCurrentPosition()
    return current?.aliyahNum || 1
  }

  /**
   * Get current phase
   */
  function getCurrentPhase(): Phase {
    const current = getCurrentPosition()
    return current?.phase || 'rishon'
  }

  /**
   * Get display text for phase (Hebrew or transliterated)
   */
  function getPhaseDisplay(phase: Phase): string {
    switch (phase) {
      case 'rishon': return 'ראשון'
      case 'sheni': return 'שני'
      case 'shlishi': return 'שלישי'
    }
  }

  /**
   * Get progress display (e.g., "Aliyah 3 of 7, Rishon")
   */
  function getProgressDisplay(): string {
    const aliyahNum = getCurrentAliyahNum()
    const phase = getCurrentPhase()
    const totalAliyot = aliyotData.value.length || 7
    return `Aliyah ${aliyahNum} of ${totalAliyot}, ${getPhaseDisplay(phase)}`
  }

  /**
   * Show completion feedback animation
   */
  function showCompletionFeedback(position: AliyahPosition) {
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
   * Scroll to first verse of specified aliyah
   */
  function scrollToAliyah(aliyahNum: number) {
    const aliyahData = getAliyahData(aliyahNum)
    if (!aliyahData) return

    const [perek, pasuk] = aliyahData.start
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
   * Handle spacebar key press
   */
  function handleSpacebarPress(event: KeyboardEvent) {
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault()
      completeCurrentPhase()
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
      currentPosition: { aliyahNum: 1, phase: 'rishon' },
      completedPhases: []
    }

    saveProgressState()
  }

  /**
   * Check if a verse is the first verse of the current aliyah
   */
  function isFirstVerseOfCurrentAliyah(perek: number, pasuk: number): boolean {
    const current = getCurrentPosition()
    if (!current) return false

    const aliyahData = getAliyahData(current.aliyahNum)
    if (!aliyahData) return false

    const [startPerek, startPasuk] = aliyahData.start
    return perek === startPerek && pasuk === startPasuk
  }

  /**
   * Get all aliyot with completion status
   */
  function getAliyotWithStatus() {
    return aliyotData.value.map((aliyah, idx) => ({
      ...aliyah,
      number: idx + 1,
      rishonCompleted: isPhaseCompleted(idx + 1, 'rishon'),
      sheniCompleted: isPhaseCompleted(idx + 1, 'sheni'),
      shlishiCompleted: isPhaseCompleted(idx + 1, 'shlishi'),
      fullyCompleted: isPhaseCompleted(idx + 1, 'rishon') &&
                      isPhaseCompleted(idx + 1, 'sheni') &&
                      isPhaseCompleted(idx + 1, 'shlishi')
    }))
  }

  // Auto-save on state changes
  watch(progressState, saveProgressState, { deep: true })

  return {
    // State
    currentPosition: computed(() => getCurrentPosition()),
    completionFeedback: computed(() => completionFeedback.value),
    progressState: computed(() => progressState.value),
    aliyotData: computed(() => aliyotData.value),

    // Methods
    initializeParsha,
    getCurrentPosition,
    setCurrentPosition,
    isPhaseCompleted,
    completeCurrentPhase,
    advanceToNextPhase,
    getAliyahData,
    isVerseInCurrentAliyah,
    isFirstVerseOfCurrentAliyah,
    getCurrentAliyahNum,
    getCurrentPhase,
    getPhaseDisplay,
    getProgressDisplay,
    handleSpacebarPress,
    resetProgress,
    getAliyotWithStatus,
    scrollToAliyah
  }
}
