<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getGameRecords, deleteGameRecord } from '../utils/db'
import { formatAmount, formatDate } from '../utils/format'
import { showConfirmDialog, showToast } from 'vant'

const router = useRouter()
const records = ref([])
const loading = ref(true)

async function loadRecords() {
  loading.value = true
  records.value = await getGameRecords()
  loading.value = false
}

onMounted(loadRecords)

const totalProfit = computed(() => records.value.reduce((sum, r) => sum + r.amount, 0))
const totalWin = computed(() => records.value.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0))
const totalLose = computed(() => records.value.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0))

async function handleDelete(record) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除这条${record.type}记录？` })
    await deleteGameRecord(record.id)
    showToast('已删除')
    await loadRecords()
  } catch {}
}
</script>

<template>
  <div class="page-container">
    <div class="section-card summary-card">
      <div class="summary-title">游戏总盈亏</div>
      <div class="summary-amount" :class="totalProfit >= 0 ? 'amount-positive' : 'amount-negative'">
        {{ totalProfit >= 0 ? '+' : '' }}{{ formatAmount(totalProfit) }}
      </div>
      <div class="summary-row">
        <span class="amount-positive">收入 +{{ formatAmount(totalWin) }}</span>
        <span class="amount-negative">支出 {{ formatAmount(totalLose) }}</span>
      </div>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <van-button type="primary" block icon="plus" @click="router.push('/game/add')">记一笔</van-button>
      <van-button plain block icon="chart-trending-o" @click="router.push('/game/stats')">统计</van-button>
    </div>

    <van-loading v-if="loading" style="text-align: center; padding: 40px;" />
    <van-empty v-else-if="records.length === 0" description="暂无记录，点击上方按钮开始记账" />

    <div v-else>
      <van-swipe-cell v-for="record in records" :key="record.id">
        <div class="section-card record-item">
          <div class="record-header">
            <div>
              <van-tag :type="record.amount >= 0 ? 'success' : 'danger'" size="medium">
                {{ record.type }}
              </van-tag>
              <van-tag v-if="record.platform" plain size="medium" style="margin-left: 4px;">
                {{ record.platform }}
              </van-tag>
            </div>
            <span class="record-date">{{ formatDate(record.createdAt) }}</span>
          </div>
          <div class="record-amount" :class="record.amount >= 0 ? 'amount-positive' : 'amount-negative'">
            {{ record.amount >= 0 ? '+' : '' }}{{ formatAmount(record.amount) }}
          </div>
          <div v-if="record.note" class="record-note">{{ record.note }}</div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDelete(record)" />
        </template>
      </van-swipe-cell>
    </div>
  </div>
</template>

<style scoped>
.summary-card { text-align: center; margin-bottom: 16px; }
.summary-title { font-size: 14px; color: #969799; margin-bottom: 8px; }
.summary-amount { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
.summary-row { display: flex; justify-content: center; gap: 24px; font-size: 14px; }
.record-item { margin-bottom: 0; }
.record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.record-date { font-size: 13px; color: #969799; }
.record-amount { font-size: 22px; font-weight: bold; }
.record-note { font-size: 13px; color: #969799; margin-top: 4px; }
</style>
