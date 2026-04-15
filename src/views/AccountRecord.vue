<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAccount, getBalanceRecords, addBalanceRecord, deleteBalanceRecord } from '../utils/db'
import { formatAmount, formatDateTime } from '../utils/format'
import { showConfirmDialog, showToast } from 'vant'
import * as echarts from 'echarts'

const route = useRoute()
const router = useRouter()
const accountId = route.params.accountId
const account = ref(null)
const records = ref([])
const loading = ref(true)
const showAdd = ref(false)
const newBalance = ref('')
const newNote = ref('')
const chartRef = ref(null)

async function loadData() {
  loading.value = true
  account.value = await getAccount(accountId)
  records.value = await getBalanceRecords(accountId)
  loading.value = false
  await nextTick()
  renderChart()
}

onMounted(loadData)

function renderChart() {
  if (!chartRef.value || records.value.length < 2) return
  const sorted = [...records.value].sort((a, b) => a.createdAt - b.createdAt)
  const dates = sorted.map((r) => {
    const d = new Date(r.createdAt)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  const values = sorted.map((r) => r.balance)

  const chart = echarts.init(chartRef.value)
  chart.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: '#1989fa' },
    }],
  })
}

async function handleAdd() {
  const bal = parseFloat(newBalance.value)
  if (isNaN(bal)) { showToast('请输入有效金额'); return }
  await addBalanceRecord({
    accountId,
    balance: bal,
    note: newNote.value.trim(),
  })
  newBalance.value = ''
  newNote.value = ''
  showAdd.value = false
  showToast('记录成功')
  await loadData()
}

async function handleDelete(record) {
  try {
    await showConfirmDialog({ title: '确认删除', message: '删除这条记录？' })
    await deleteBalanceRecord(record.id)
    showToast('已删除')
    await loadData()
  } catch {}
}

function getChange(index) {
  if (index >= records.value.length - 1) return null
  return records.value[index].balance - records.value[index + 1].balance
}
</script>

<template>
  <van-nav-bar :title="account?.name || '账户详情'" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <div class="section-card" style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 14px; color: #969799;">当前余额</div>
      <div style="font-size: 28px; font-weight: bold; color: #07c160;">
        {{ formatAmount(account?.balance || 0) }}
      </div>
    </div>

    <!-- 余额走势图 -->
    <div v-if="records.length >= 2" class="section-card">
      <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px;">余额走势</div>
      <div ref="chartRef" style="width: 100%; height: 200px;"></div>
    </div>

    <van-button type="primary" block icon="plus" style="margin-bottom: 12px;" @click="showAdd = true">
      更新余额
    </van-button>

    <van-loading v-if="loading" style="text-align: center; padding: 40px;" />
    <van-empty v-else-if="records.length === 0" description="暂无变动记录" />

    <van-swipe-cell v-for="(record, index) in records" :key="record.id">
      <div class="section-card record-item">
        <div class="record-header">
          <span class="record-balance">{{ formatAmount(record.balance) }}</span>
          <span v-if="getChange(index) !== null" class="record-change"
            :class="getChange(index) >= 0 ? 'amount-positive' : 'amount-negative'">
            {{ getChange(index) >= 0 ? '+' : '' }}{{ formatAmount(getChange(index)) }}
          </span>
        </div>
        <div class="record-meta">
          <span>{{ formatDateTime(record.createdAt) }}</span>
          <span v-if="record.note" style="margin-left: 8px; color: #969799;">{{ record.note }}</span>
        </div>
      </div>
      <template #right>
        <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDelete(record)" />
      </template>
    </van-swipe-cell>
  </div>

  <van-dialog v-model:show="showAdd" title="更新余额" show-cancel-button @confirm="handleAdd">
    <div style="padding: 16px;">
      <van-field v-model="newBalance" type="number" label="新余额" placeholder="请输入当前最新余额" />
      <van-field v-model="newNote" label="备注" placeholder="可选" />
    </div>
  </van-dialog>
</template>

<style scoped>
.record-item { margin-bottom: 0; }
.record-header { display: flex; justify-content: space-between; align-items: center; }
.record-balance { font-size: 18px; font-weight: bold; }
.record-change { font-size: 14px; font-weight: bold; }
.record-meta { font-size: 13px; color: #969799; margin-top: 4px; }
</style>
