<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed({
  get: () => {
    if (route.path.startsWith('/game')) return 'game'
    if (route.path.startsWith('/assets')) return 'assets'
    if (route.path.startsWith('/settings')) return 'settings'
    return 'game'
  },
  set: (val) => {
    router.push('/' + val)
  },
})
</script>

<template>
  <router-view />
  <van-tabbar v-model="activeTab" route>
    <van-tabbar-item name="game" to="/game" icon="balance-o">游戏收支</van-tabbar-item>
    <van-tabbar-item name="assets" to="/assets" icon="gold-coin-o">家庭资产</van-tabbar-item>
    <van-tabbar-item name="settings" to="/settings" icon="setting-o">设置</van-tabbar-item>
  </van-tabbar>
</template>
