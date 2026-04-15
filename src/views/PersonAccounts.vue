<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAccountsByPerson, deleteAccount, getPersons } from '../utils/db'
import { formatAmount, formatDate, getAccountTypeLabel } from '../utils/format'
import { showConfirmDialog, showToast } from 'vant'

const route = useRoute()
const router = useRouter()
const personId = route.params.personId
const accounts = ref([])
const personName = ref('')
const loading = ref(true)

async function loadData() {
  loading.value = true
  const persons = await getPersons()
  const person = persons.find((p) => p.id === personId)
  personName.value = person?.name || ''
  accounts.value = await getAccountsByPerson(personId)
  loading.value = false
}

onMounted(loadData)

const total = computed(() => accounts.value.reduce((sum, a) => sum + (a.balance || 0), 0))

async function handleDelete(account) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除账户"${account.name}"及其所有记录？` })
    await deleteAccount(account.id)
    showToast('已删除')
    await loadData()
  } catch {}
}
</script>

<template>
  <van-nav-bar :title="personName + '的账户'" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <div class="section-card" style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 14px; color: #969799;">总资产</div>
      <div style="font-size: 28px; font-weight: bold; color: #07c160;">{{ formatAmount(total) }}</div>
    </div>

    <van-button type="primary" block icon="plus" style="margin-bottom: 12px;"
      @click="router.push(`/assets/account/${personId}/add`)">
      添加账户
    </van-button>

    <van-loading v-if="loading" style="text-align: center; padding: 40px;" />
    <van-empty v-else-if="accounts.length === 0" description="暂无账户" />

    <van-swipe-cell v-for="account in accounts" :key="account.id">
      <div class="section-card account-item" @click="router.push(`/assets/record/${account.id}`)">
        <div class="account-header">
          <div>
            <div class="account-name">{{ account.name }}</div>
            <van-tag plain size="medium">{{ getAccountTypeLabel(account.type) }}</van-tag>
          </div>
          <div style="text-align: right;">
            <div class="account-balance">{{ formatAmount(account.balance || 0) }}</div>
            <div class="account-updated">{{ account.updatedAt ? formatDate(account.updatedAt) : formatDate(account.createdAt) }} 更新</div>
          </div>
        </div>
        <div class="account-meta">
          <span v-if="account.phone">手机: {{ account.phone }}</span>
          <span v-if="account.accountId">账户: {{ account.accountId }}</span>
        </div>
        <div v-if="account.remark" class="account-remark">{{ account.remark }}</div>
      </div>
      <template #right>
        <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDelete(account)" />
      </template>
    </van-swipe-cell>
  </div>
</template>

<style scoped>
.account-item { cursor: pointer; }
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.account-name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
.account-balance { font-size: 20px; font-weight: bold; color: #07c160; }
.account-updated { font-size: 12px; color: #969799; margin-top: 2px; }
.account-meta { display: flex; gap: 12px; font-size: 13px; color: #969799; margin-top: 6px; }
.account-remark { font-size: 13px; color: #969799; margin-top: 4px; }
</style>
