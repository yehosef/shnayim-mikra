import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerOffline } from './composables/useOffline'
import { removeItem } from './lib/storage'

// One-time cleanup: the stored aliyah pointer from the deleted
// useAliyahNavigation composable. Position is now derived from per-verse
// progress and is never stored.
removeItem('shnayim-aliyah-progress')

registerOffline()

createApp(App).mount('#app')
