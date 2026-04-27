import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { initDefaultPersons, initDefaultLedgers } from './utils/db'
import 'vant/lib/index.css'
import './style.css'

;(async () => {
  await initDefaultPersons()
  await initDefaultLedgers()
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
})()
