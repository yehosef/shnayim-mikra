import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Register service worker for offline support
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createApp(App).mount('#app')
