/**
 * Aliyah Navigation Composable (Singleton)
 * Manages Torah study tracking at the aliyah level with three phases:
 * Rishon (first reading), Sheni (second reading), Shlishi (Targum reading)
 *
 * All reactive state lives at module level so every caller shares the same instance.
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

// --------------- Module-level singleton state ---------------

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

const progressState = ref<AliyahProgressState>(loadProgressState())
const currentParsha = ref<string>('')
const aliyotData = ref<AliyahData[]>([])
const completionFeedback = ref<CompletionFeedback>({
  isVisible: false,
  position: null
})

// Debounced save with beforeunload flush
let saveTimer: ReturnType<typeof setTimeout> | null = null

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

// Auto-save on state changes (single watcher, set up once at module level)
watch(progressState, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveProgressState()
    saveTimer = null
  }, 300)
}, { deep: true })

// Flush pending save on tab close
window.addEventListener('beforeunload', () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveProgressState()
  }
})

// --------------- Composable function ---------------

export function useAliyahNavigation() {

  /**
   * Load aliyot data from JSON file
   */
  async function loadAliyotData(parsha: string): Promise<AliyahData[]> {
    try {
      if (aliyotDataCache && aliyotDataCache[parsha]) {
        return aliyotDataCache[parsha]
      }

      const response = await fetch('/data/aliyot.json')
      const data = await response.json()

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

    const data = await loadAliyotData(parsha)
    aliyotData.value = data

    if (!progressState.value[parsha]) {
      progressState.value[parsha] = {
        date: getTodayDateString(),
        currentPosition: { aliyahNum: 1, phase: 'rishon' },
        completedPhases: []
      }
    } else {
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

  function getCurrentPosition(): AliyahPosition | null {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return null
    }
    return progressState.value[currentParsha.value].currentPosition
  }

  function setCurrentPosition(position: AliyahPosition | null) {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }
    progressState.value[currentParsha.value].currentPosition = position
    saveProgressState()
  }

  function isPhaseCompleted(aliyahNum: number, phase: Phase): boolean {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return false
    }
    const completed = progressState.value[currentParsha.value].completedPhases
    return completed.some(p => p.aliyahNum === aliyahNum && p.phase === phase)
  }

  function completeCurrentPhase() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    const completed = progressState.value[currentParsha.value].completedPhases

    if (!isPhaseCompleted(current.aliyahNum, current.phase)) {
      completed.push({ aliyahNum: current.aliyahNum, phase: current.phase })
    }

    showCompletionFeedback(current)
    saveProgressState()

    setTimeout(() => {
      advanceToNextPhase()
    }, 600)
  }

  function advanceToNextPhase() {
    if (!currentParsha.value || !progressState.value[currentParsha.value]) {
      return
    }

    const current = getCurrentPosition()
    if (!current) return

    let nextAliyahNum = current.aliyahNum
    let nextPhaseIndex = PHASE_ORDER.indexOf(current.phase) + 1

    if (nextPhaseIndex >= PHASE_ORDER.length) {
      nextAliyahNum++
      nextPhaseIndex = 0

      if (nextAliyahNum > aliyotData.value.length) {
        nextAliyahNum = 1
      }
    }

    const nextPhase = PHASE_ORDER[nextPhaseIndex]
    setCurrentPosition({ aliyahNum: nextAliyahNum, phase: nextPhase })
    scrollToAliyah(nextAliyahNum)
  }

  function getAliyahData(aliyahNum: number): AliyahData | null {
    if (!aliyotData.value || aliyahNum < 1 || aliyahNum > aliyotData.value.length) {
      return null
    }
    return aliyotData.value[aliyahNum - 1]
  }

  function isVerseInCurrentAliyah(perek: number, pasuk: number): boolean {
    const current = getCurrentPosition()
    if (!current) return false

    const ad = getAliyahData(current.aliyahNum)
    if (!ad) return false

    const [startPerek, startPasuk] = ad.start
    const [endPerek, endPasuk] = ad.end

    if (perek < startPerek || perek > endPerek) return false
    if (perek === startPerek && pasuk < startPasuk) return false
    if (perek === endPerek && pasuk > endPasuk) return false

    return true
  }

  function getCurrentAliyahNum(): number {
    const current = getCurrentPosition()
    return current?.aliyahNum || 1
  }

  function getCurrentPhase(): Phase {
    const current = getCurrentPosition()
    return current?.phase || 'rishon'
  }

  function getPhaseDisplay(phase: Phase): string {
    switch (phase) {
      case 'rishon': return '\u05E8\u05D0\u05E9\u05D5\u05DF'
      case 'sheni': return '\u05E9\u05E0\u05D9'
      case 'shlishi': return '\u05E9\u05DC\u05D9\u05E9\u05D9'
    }
  }

  function getProgressDisplay(): string {
    const aliyahNum = getCurrentAliyahNum()
    const phase = getCurrentPhase()
    const totalAliyot = aliyotData.value.length || 7
    return `Aliyah ${aliyahNum} of ${totalAliyot}, ${getPhaseDisplay(phase)}`
  }

  function showCompletionFeedback(position: AliyahPosition) {
    completionFeedback.value = {
      isVisible: true,
      position: { ...position }
    }

    setTimeout(() => {
      completionFeedback.value = {
        isVisible: false,
        position: null
      }
    }, 400)
  }

  function scrollToAliyah(aliyahNum: number) {
    const ad = getAliyahData(aliyahNum)
    if (!ad) return

    const [perek, pasuk] = ad.start
    const selector = `[data-perek="${perek}"][data-pasuk="${pasuk}"]`
    const element = document.querySelector(selector)

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function getTodayDateString(): string {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  function handleSpacebarPress(event: KeyboardEvent) {
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault()
      completeCurrentPhase()
    }
  }

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

  function isFirstVerseOfCurrentAliyah(perek: number, pasuk: number): boolean {
    const current = getCurrentPosition()
    if (!current) return false

    const ad = getAliyahData(current.aliyahNum)
    if (!ad) return false

    const [startPerek, startPasuk] = ad.start
    return perek === startPerek && pasuk === startPasuk
  }

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

  return {
    // State (shared across all callers)
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
