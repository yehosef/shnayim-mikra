import { ref, watch } from 'vue'

function loadProgress() {
  const stored = localStorage.getItem('shnayim-progress')
  if (!stored) return {}
  try {
    return JSON.parse(stored)
  } catch (e) {
    console.warn('Could not parse saved progress, starting fresh:', e)
    return {}
  }
}

const progress = ref(loadProgress())

let progressTimer = null
watch(progress, (val) => {
  clearTimeout(progressTimer)
  progressTimer = setTimeout(() => {
    localStorage.setItem('shnayim-progress', JSON.stringify(val))
    progressTimer = null
  }, 300)
}, { deep: true })

window.addEventListener('beforeunload', () => {
  if (progressTimer) {
    clearTimeout(progressTimer)
    localStorage.setItem('shnayim-progress', JSON.stringify(progress.value))
  }
})

export function useProgress() {
  const getVerseProgress = (parasha, verseKey) => {
    return progress.value[parasha]?.[verseKey] || {
      hebrew1: false,
      hebrew2: false,
      targum: false
    }
  }

  const setVerseProgress = (parasha, verseKey, field, value) => {
    if (!progress.value[parasha]) {
      progress.value[parasha] = {}
    }
    if (!progress.value[parasha][verseKey]) {
      progress.value[parasha][verseKey] = { hebrew1: false, hebrew2: false, targum: false }
    }
    progress.value[parasha][verseKey][field] = value
  }

  const getParshaStats = (parasha, totalVerses) => {
    const parshaProgress = progress.value[parasha] || {}
    let completed = 0
    Object.values(parshaProgress).forEach(verse => {
      if (verse.hebrew1 && verse.hebrew2 && verse.targum) {
        completed++
      }
    })
    return {
      completed,
      total: totalVerses,
      percentage: totalVerses > 0 ? Math.round((completed / totalVerses) * 100) : 0
    }
  }

  const clearParshaProgress = (parasha) => {
    if (progress.value[parasha]) {
      delete progress.value[parasha]
    }
  }

  return {
    progress,
    getVerseProgress,
    setVerseProgress,
    getParshaStats,
    clearParshaProgress
  }
}
