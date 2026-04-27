<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getLedgers, addLedger, updateLedger, deleteLedger,
  getRecordsByLedger, deleteRecord,
  getCurrentLedgerId, setCurrentLedgerId,
  getCategories,
} from '../utils/db'
import { formatAmount, formatDate } from '../utils/format'
import { showConfirmDialog, showToast, showDialog } from 'vant'

const router = useRouter()

const ledgers = ref([])
const currentLedgerId = ref('')
const records = ref([])
const loading = ref(true)
const showLedgerSheet = ref(false)
const showAddLedger = ref(false)
const newLedgerName = ref('')

const currentLedger = computed(() => ledgers.value.find((l) => l.id === currentLedgerId.value))

async function loadAll() {
  loading.value = true
  ledgers.value = await getLedgers()
  let cur = await getCurrentLedgerId()
  if (!ledgers.value.some((l) => l.id === cur)) {
    cur = ledgers.value[0]?.id || ''
    await setCurrentLedgerId(cur)
  }
  currentLedgerId.value = cur
  await loadRecords()
  loading.value = false
}

async function loadRecords() {
  if (!currentLedgerId.value) { records.value = []; return }
  records.value = await getRecordsByLedger(currentLedgerId.value)
}

onMounted(loadAll)

const totalProfit = computed(() => records.value.reduce((sum, r) => {
  const sign = r.direction === 'income' ? 1 : -1
  return sum + sign * (r.amount || 0)
}, 0))
const totalIn = computed(() => records.value.filter((r) => r.direction === 'income').reduce((s, r) => s + (r.amount || 0), 0))
const totalOut = computed(() => records.value.filter((r) => r.direction === 'expense').reduce((s, r) => s + (r.amount || 0), 0))

async function switchLedger(id) {
  if (id === currentLedgerId.value) {
    showLedgerSheet.value = false
    return
  }
  currentLedgerId.value = id
  await setCurrentLedgerId(id)
  showLedgerSheet.value = false
  await loadRecords()
}

async function handleAddLedger() {
  const name = newLedgerName.value.trim()
  if (!name) { showToast('请输入账本名称'); return }
  if (ledgers.value.some((l) => l.name === name)) { showToast('已存在同名账本'); return }
  const created = await addLedger(name)
  newLedgerName.value = ''
  showAddLedger.value = false
  ledgers.value = await getLedgers()
  await switchLedger(created.id)
  showToast('账本已创建，可在设置里编辑分类')
}

async function handleDelete(record) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除这条记录？` })
    await deleteRecord(record.id)
    showToast('已删除')
    await loadRecords()
  } catch {}
}

function categoryLabel(record) {
  const parts = []
  if (record.category1Name) parts.push(record.category1Name)
  if (record.category2Name) parts.push(record.category2Name)
  return parts.join(' · ')
}
</script>

<template>
  <div class="page-container">
    <!-- 账本切换条 -->
    <div class="ledger-bar" @click="showLedgerSheet = true">
      <div class="ledger-name">
        <van-icon :name="currentLedger?.icon || 'balance-o'" size="18" />
        <span>{{ currentLedger?.name || '选择账本' }}</span>
        <van-icon name="arrow-down" size="14" style="opacity:.6" />
      </div>
      <div class="ledger-hint small">点击切换 / 新建</div>
    </div>

    <div class="section-card summary-card">
      <div class="summary-title">{{ currentLedger?.name || '账本' }} · 总盈亏</div>
      <div class="summary-amount" :class="totalProfit >= 0 ? 'amount-positive' : 'amount-negative'">
        {{ totalProfit >= 0 ? '+' : '' }}{{ formatAmount(totalProfit) }}
      </div>
      <div class="summary-row">
        <span class="amount-positive">收入 +{{ formatAmount(totalIn) }}</span>
        <span class="amount-negative">支出 -{{ formatAmount(totalOut) }}</span>
      </div>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <van-button type="primary" block icon="plus" @click="router.push('/game/add')">记一笔</van-button>
      <van-button plain block icon="chart-trending-o" @click="router.push('/game/stats')">统计</van-button>
      <van-button plain block icon="photograph" @click="router.push('/game/report')">导出</van-button>
    </div>

    <van-loading v-if="loading" style="text-align: center; padding: 40px;" />
    <van-empty v-else-if="records.length === 0" description="本账本暂无记录" />

    <div v-else>
      <van-swipe-cell v-for="record in records" :key="record.id">
        <div class="section-card record-item">
          <div class="record-header">
            <div>
              <van-tag :type="record.direction === 'income' ? 'success' : 'danger'" size="medium">
                {{ record.direction === 'income' ? '收入' : '支出' }}
              </van-tag>
              <van-tag v-if="categoryLabel(record)" plain size="medium" style="margin-left: 4px;">
                {{ categoryLabel(record) }}
              </van-tag>
              <van-tag v-else-if="record.legacyType" plain size="medium" style="margin-left: 4px;">
                {{ record.legacyType }}
              </van-tag>
            </div>
            <span class="record-date">{{ formatDate(record.createdAt) }}</span>
          </div>
          <div class="record-amount" :class="record.direction === 'income' ? 'amount-positive' : 'amount-negative'">
            {{ record.direction === 'income' ? '+' : '-' }}{{ formatAmount(record.amount) }}
          </div>
          <div v-if="record.note" class="record-note">{{ record.note }}</div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDelete(record)" />
        </template>
      </van-swipe-cell>
    </div>
  </div>

  <!-- 账本切换弹层 -->
  <van-action-sheet v-model:show="showLedgerSheet" title="切换账本" cancel-text="取消" close-on-click-action>
    <div class="ledger-list">
      <div v-for="l in ledgers" :key="l.id" class="ledger-item" :class="{active: l.id === currentLedgerId}" @click="switchLedger(l.id)">
        <van-icon :name="l.icon || 'balance-o'" size="20" />
        <span>{{ l.name }}</span>
        <van-icon v-if="l.id === currentLedgerId" name="success" color="#1989fa" />
      </div>
      <div class="ledger-item add" @click="showLedgerSheet = false; showAddLedger = true">
        <van-icon name="plus" size="20" />
        <span>新建账本</span>
      </div>
    </div>
  </van-action-sheet>

  <van-dialog v-model:show="showAddLedger" title="新建账本" show-cancel-button @confirm="handleAddLedger">
    <van-field v-model="newLedgerName" placeholder="如：日常开支 / AI 基金" style="margin: 16px;" />
    <div class="small text-muted" style="margin: 0 16px 16px;">新建账本会自动初始化默认收入/支出分类，之后可在设置里编辑。</div>
  </van-dialog>
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
.small { font-size: 12px; }
.text-muted { color: #969799; }
.ledger-bar {
  background: linear-gradient(90deg, #1989fa, #5fb8ff);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.ledger-name { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
.ledger-hint { opacity: .8; }
.ledger-list { padding: 8px 0; }
.ledger-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; cursor: pointer;
  border-bottom: 1px solid #ebedf0;
}
.ledger-item:last-child { border-bottom: none; }
.ledger-item.active { background: #f4f8ff; }
.ledger-item.add { color: #1989fa; }
</style>
