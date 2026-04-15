<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getPersons, addPerson, deletePerson, getAllAccounts, initDefaultPersons } from '../utils/db'
import { formatAmount, formatDate, getAccountTypeLabel, ACCOUNT_TYPES } from '../utils/format'
import { showConfirmDialog, showToast } from 'vant'
import * as echarts from 'echarts'

const router = useRouter()
const persons = ref([])
const accounts = ref([])
const loading = ref(true)
const showAddPerson = ref(false)
const newPersonName = ref('')
const pieChartRef = ref(null)
const barChartRef = ref(null)

// 类型明细弹窗
const showTypeDetail = ref(false)
const selectedTypeName = ref('')
const selectedTypeAccounts = ref([])

async function loadData() {
  loading.value = true
  await initDefaultPersons()
  persons.value = await getPersons()
  accounts.value = await getAllAccounts()
  loading.value = false
  await nextTick()
  renderPieChart()
  renderBarChart()
}

onMounted(loadData)

function getPersonAccounts(personId) {
  return accounts.value.filter((a) => a.personId === personId)
}

function getPersonTotal(personId) {
  return getPersonAccounts(personId).reduce((sum, a) => sum + (a.balance || 0), 0)
}

function getPersonName(personId) {
  return persons.value.find((p) => p.id === personId)?.name || ''
}

const grandTotal = computed(() => accounts.value.reduce((sum, a) => sum + (a.balance || 0), 0))

// 按类型汇总
const typeStats = computed(() => {
  const map = {}
  for (const a of accounts.value) {
    const label = getAccountTypeLabel(a.type)
    if (!map[label]) map[label] = { type: a.type, label, total: 0, count: 0 }
    map[label].total += (a.balance || 0)
    map[label].count++
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
})

function showTypeAccounts(typeLabel) {
  selectedTypeName.value = typeLabel
  selectedTypeAccounts.value = accounts.value
    .filter((a) => getAccountTypeLabel(a.type) === typeLabel)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
  showTypeDetail.value = true
}

function renderPieChart() {
  if (!pieChartRef.value || accounts.value.length === 0) return
  const data = typeStats.value
    .filter((t) => t.total > 0)
    .map((t) => ({ name: t.label, value: t.total }))

  if (data.length === 0) return
  const chart = echarts.init(pieChartRef.value)
  chart.setOption({
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data,
      label: { formatter: '{b}\n{d}%' },
    }],
  })
  // 点击饼图扇区，弹出明细
  chart.off('click')
  chart.on('click', (params) => {
    showTypeAccounts(params.name)
  })
}

function renderBarChart() {
  if (!barChartRef.value || persons.value.length === 0) return
  const names = persons.value.map((p) => p.name)
  const totals = persons.value.map((p) => getPersonTotal(p.id))

  if (totals.every((t) => t === 0)) return
  const chart = echarts.init(barChartRef.value)
  chart.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: totals.map((v) => ({
        value: v,
        itemStyle: { color: '#07c160' },
      })),
      barWidth: '40%',
    }],
  })
}

async function handleAddPerson() {
  const name = newPersonName.value.trim()
  if (!name) { showToast('请输入姓名'); return }
  await addPerson(name)
  newPersonName.value = ''
  showAddPerson.value = false
  await loadData()
}

async function handleDeletePerson(person) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: `删除"${person.name}"及其所有账户数据？此操作不可恢复。`,
    })
    await deletePerson(person.id)
    showToast('已删除')
    await loadData()
  } catch {}
}
</script>

<template>
  <div class="page-container">
    <div class="section-card summary-card">
      <div class="summary-title">家庭总资产</div>
      <div class="summary-amount amount-positive">{{ formatAmount(grandTotal) }}</div>
    </div>

    <van-loading v-if="loading" style="text-align: center; padding: 40px;" />

    <template v-else>
      <!-- 资产分布饼图 -->
      <div v-if="accounts.length > 0" class="section-card">
        <div class="chart-title">资产类型分布（点击查看明细）</div>
        <div ref="pieChartRef" style="width: 100%; height: 220px;"></div>
      </div>

      <!-- 类型汇总列表 -->
      <div v-if="typeStats.length > 0" class="section-card">
        <div class="chart-title">分类汇总</div>
        <div v-for="stat in typeStats" :key="stat.label" class="type-row" @click="showTypeAccounts(stat.label)">
          <span class="type-label">{{ stat.label }}</span>
          <span class="type-count">{{ stat.count }}个账户</span>
          <span class="type-total">{{ formatAmount(stat.total) }}</span>
          <van-icon name="arrow" size="14" color="#969799" />
        </div>
      </div>

      <!-- 成员资产对比柱状图 -->
      <div v-if="persons.length > 0" class="section-card">
        <div class="chart-title">成员资产对比</div>
        <div ref="barChartRef" style="width: 100%; height: 200px;"></div>
      </div>

      <!-- 人员列表 -->
      <van-swipe-cell v-for="person in persons" :key="person.id">
        <div class="section-card person-card" @click="router.push(`/assets/account/${person.id}`)">
          <div class="person-header">
            <span class="person-name">{{ person.name }}</span>
            <span class="person-total">{{ formatAmount(getPersonTotal(person.id)) }}</span>
          </div>
          <div class="account-tags">
            <van-tag
              v-for="acc in getPersonAccounts(person.id)"
              :key="acc.id"
              plain
              size="medium"
              style="margin: 2px 4px 2px 0;"
            >
              {{ acc.name }} {{ formatAmount(acc.balance || 0) }}
            </van-tag>
            <van-tag v-if="getPersonAccounts(person.id).length === 0" plain type="default" size="medium">
              暂无账户，点击添加
            </van-tag>
          </div>
        </div>
        <template #right>
          <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDeletePerson(person)" />
        </template>
      </van-swipe-cell>

      <van-button plain block icon="plus" style="margin-top: 12px;" @click="showAddPerson = true">
        添加成员
      </van-button>
    </template>
  </div>

  <!-- 添加成员弹窗 -->
  <van-dialog v-model:show="showAddPerson" title="添加成员" show-cancel-button @confirm="handleAddPerson">
    <van-field v-model="newPersonName" placeholder="请输入姓名" style="margin: 16px;" />
  </van-dialog>

  <!-- 类型明细弹窗 -->
  <van-popup v-model:show="showTypeDetail" position="bottom" round style="max-height: 70%;">
    <div style="padding: 16px;">
      <div style="font-size: 17px; font-weight: bold; margin-bottom: 4px;">{{ selectedTypeName }}</div>
      <div style="font-size: 14px; color: #969799; margin-bottom: 16px;">
        共 {{ selectedTypeAccounts.length }} 个账户，合计 {{ formatAmount(selectedTypeAccounts.reduce((s, a) => s + (a.balance || 0), 0)) }}
      </div>
      <div v-for="acc in selectedTypeAccounts" :key="acc.id" class="detail-item" @click="router.push(`/assets/record/${acc.id}`); showTypeDetail = false">
        <div class="detail-header">
          <div>
            <div style="font-weight: bold;">{{ acc.name }}</div>
            <div style="font-size: 13px; color: #969799;">{{ getPersonName(acc.personId) }}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; color: #07c160;">{{ formatAmount(acc.balance || 0) }}</div>
            <div style="font-size: 12px; color: #969799;">{{ acc.updatedAt ? formatDate(acc.updatedAt) : formatDate(acc.createdAt) }} 更新</div>
          </div>
        </div>
        <div v-if="acc.phone || acc.accountId" class="detail-meta">
          <span v-if="acc.phone">手机: {{ acc.phone }}</span>
          <span v-if="acc.accountId">账户: {{ acc.accountId }}</span>
        </div>
        <div v-if="acc.remark" style="font-size: 13px; color: #969799; margin-top: 4px;">{{ acc.remark }}</div>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.summary-card { text-align: center; margin-bottom: 16px; }
.summary-title { font-size: 14px; color: #969799; margin-bottom: 8px; }
.summary-amount { font-size: 32px; font-weight: bold; }
.chart-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; }
.person-card { cursor: pointer; }
.person-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.person-name { font-size: 17px; font-weight: bold; }
.person-total { font-size: 17px; font-weight: bold; color: #07c160; }
.account-tags { margin-top: 4px; }
.type-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.type-row:last-child { border-bottom: none; }
.type-label { flex: 1; font-size: 15px; }
.type-count { font-size: 13px; color: #969799; margin-right: 12px; }
.type-total { font-size: 15px; font-weight: bold; color: #07c160; margin-right: 8px; }
.detail-item {
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.detail-header { display: flex; justify-content: space-between; align-items: center; }
.detail-meta { display: flex; gap: 12px; font-size: 13px; color: #969799; margin-top: 6px; }
</style>
