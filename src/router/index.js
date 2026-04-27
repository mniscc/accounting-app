import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/game',
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('../views/GameList.vue'),
  },
  {
    path: '/game/add',
    name: 'GameAdd',
    component: () => import('../views/GameAdd.vue'),
  },
  {
    path: '/game/stats',
    name: 'GameStats',
    component: () => import('../views/GameStats.vue'),
  },
  {
    path: '/game/report',
    name: 'LedgerReport',
    component: () => import('../views/LedgerReport.vue'),
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('../views/AssetOverview.vue'),
  },
  {
    path: '/assets/account/:personId',
    name: 'PersonAccounts',
    component: () => import('../views/PersonAccounts.vue'),
  },
  {
    path: '/assets/account/:personId/add',
    name: 'AccountAdd',
    component: () => import('../views/AccountAdd.vue'),
  },
  {
    path: '/assets/record/:accountId',
    name: 'AccountRecord',
    component: () => import('../views/AccountRecord.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
  },
  {
    path: '/settings/categories/:ledgerId',
    name: 'CategoryEdit',
    component: () => import('../views/CategoryEdit.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
