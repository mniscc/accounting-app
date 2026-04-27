<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getRecordsByLedger, getCurrentLedgerId, getLedger } from '../utils/db'
import { formatAmount } from '../utils/format'
import * as echarts from 'echarts'

const router = useRouter()
const ledgerId = ref('')
const ledger = ref(null)
const allRecords = ref([])
const period = ref('all')
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const chartRef = ref(null)
const pieChartRef = ref(null)
const platformChartRef = ref(null)

onMounted(async () => {
  ledgerId.value = await getCurrentLedgerId()
  ledger.value = await getLedger(ledgerId.value)
  allRecords.value = await getRecordsByLedger(ledgerId.value)
  await nextTick()
  renderCharts()
})

// 给每条记录算一个带符号的"金额"用于分析
function signedAmount(r) {
  const sign = r.direction === 'income' ? 1 : -1
  return sign * (r.amount || 0)
}

// 兼容字段：把当前记录映射到统计用的 type/platform
function recType(r) { return r.category1Name || r.legacyType || '未分类' }
function recPlatform(r) { return r.category2Name || r.platform || '' }

// 可选年份列表
const availableYears = computed(() => {
  const years = new Set(allRecords.value.map((r) => new Date(r.createdAt).getFullYear()))
  if (years.size === 0) years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
})

const months = [1,2,3,4,5,6,7,8,9,10,11,12]

const records = computed(() => {
  if (period.value === 'all') return allRecords.value
  return allRecords.value.filter((r) => {
    const d = new Date(r.createdAt)
    if (period.value === 'year') return d.getFullYear() === selectedYear.value
    if (period.value === 'month') return d.getFullYear() === selectedYear.value && d.getMonth() + 1 === selectedMonth.value
    return true
  })
})

const totalProfit = computed(() => records.value.reduce((sum, r) => sum + signedAmount(r), 0))
const totalIn = computed(() => records.value.filter((r) => r.direction === 'income').reduce((s, r) => s + (r.amount || 0), 0))
const totalOut = computed(() => records.value.filter((r) => r.direction === 'expense').reduce((s, r) => s + (r.amount || 0), 0))
const totalCount = computed(() => records.value.length)

watch([period, selectedYear, selectedMonth], async () => {
  await nextTick()
  renderCharts()
})

const statsByType = computed(() => {
  const map = {}
  for (const r of records.value) {
    const t = recType(r)
    if (!map[t]) map[t] = { win: 0, lose: 0, count: 0 }
    map[t].count++
    const amt = signedAmount(r)
    if (amt >= 0) map[t].win += amt
    else map[t].lose += amt
  }
  return Object.entries(map).map(([type, data]) => ({
    type, ...data, total: data.win + data.lose,
  }))
})

const statsByPlatform = computed(() => {
  const map = {}
  for (const r of records.value) {
    const p = recPlatform(r)
    if (!p) continue
    if (!map[p]) map[p] = { win: 0, lose: 0, count: 0 }
    map[p].count++
    const amt = signedAmount(r)
    if (amt >= 0) map[p].win += amt
    else map[p].lose += amt
  }
  return Object.entries(map).map(([platform, data]) => ({
    platform, ...data, total: data.win + data.lose,
  }))
})

function renderCharts() {
  renderTrendChart()
  renderPieChart()
  renderPlatformChart()
}

function renderTrendChart() {
  if (!chartRef.value) return
  const chart = echarts.init(chartRef.value)
  if (records.value.length === 0) { chart.clear(); return }

  if (period.value === 'year') {
    const monthMap = {}
    for (const r of records.value) {
      const m = new Date(r.createdAt).getMonth() + 1
      if (!monthMap[m]) monthMap[m] = 0
      monthMap[m] += signedAmount(r)
    }
    chart.setOption({
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: months.map((m) => m + '月') },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: months.map((m) => ({
          value: monthMap[m] || 0,
          itemStyle: { color: (monthMap[m] || 0) >= 0 ? '#07c160' : '#ee0a24' },
        })),
      }],
    }, true)
    return
  }

  const sorted = [...records.value].sort((a, b) => a.createdAt - b.createdAt)
  let cumulative = 0
  const data = sorted.map((r) => {
    cumulative += signedAmount(r)
    const d = new Date(r.createdAt)
    return [`${d.getMonth() + 1}/${d.getDate()}`, cumulative]
  })

  chart.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d[0]) },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: data.map((d) => d[1]),
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: data[data.length - 1]?.[1] >= 0 ? '#07c160' : '#ee0a24' },
    }],
  }, true)
}

function renderPieChart() {
  if (!pieChartRef.value) return
  const chart = echarts.init(pieChartRef.value)
  if (records.value.length === 0) { chart.clear(); return }
  const map = {}
  for (const r of records.value) {
    const t = recType(r)
    if (!map[t]) map[t] = 0
    map[t] += Math.abs(signedAmount(r))
  }
  const data = Object.entries(map).map(([name, value]) => ({ name, value }))
  chart.setOption({
    series: [{ type: 'pie', radius: ['40%', '70%'], data, label: { formatter: '{b}\n{d}%' } }],
  }, true)
}

function renderPlatformChart() {
  if (!platformChartRef.value) return
  const chart = echarts.init(platformChartRef.value)
  if (statsByPlatform.value.length === 0) { chart.clear(); return }
  const platforms = statsByPlatform.value.map((s) => s.platform)
  const profits = statsByPlatform.value.map((s) => s.total)
  chart.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: platforms },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: profits.map((v) => ({
        value: v, itemStyle: { color: v >= 0 ? '#07c160' : '#ee0a24' },
      })),
    }],
  }, true)
}
</script>

<template>
  <van-nav-bar :title="`统计 · ${ledger?.name || ''}`" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <!-- 时间筛选 -->
    <div class="section-card filter-bar">
      <van-radio-group v-model="period" direction="horizontal">
        <van-radio name="all">全部</van-radio>
        <van-radio name="year">年度</van-radio>
        <van-radio name="month">月份</van-radio>
      </van-radio-group>
      <div v-if="period !== 'all'" class="filter-selects">
        <select v-model="selectedYear" class="filter-select">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}年</option>
        </select>
        <select v-if="period === 'month'" v-model="selectedMonth" class="filter-select">
          <option v-for="m in months" :key="m" :value="m">{{ m }}月</option>
        </select>
      </div>
    </div>

    <div class="section-card summary-card">
      <div class="summary-row">
        <div class="summary-item">
          <div class="summary-label">总盈亏</div>
          <div :class="totalProfit >= 0 ? 'amount-positive' : 'amount-negative'" style="font-size: 22px; font-weight: bold;">
            {{ totalProfit >= 0 ? '+' : '' }}{{ formatAmount(totalProfit) }}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">条数</div>
          <div style="font-size: 22px; font-weight: bold;">{{ totalCount }}</div>
        </div>
      </div>
      <div class="summary-row" style="margin-top: 8px;">
        <span class="amount-positive" style="font-size: 14px;">收入 +{{ formatAmount(totalIn) }}</span>
        <span class="amount-negative" style="font-size: 14px;">支出 -{{ formatAmount(totalOut) }}</span>
      </div>
    </div>

    <van-empty v-if="records.length === 0" description="该时段暂无数据" />
    <template v-else>
      <div class="section-card">
        <div class="chart-title">{{ period === 'year' ? '各月盈亏' : '累计盈亏走势' }}</div>
        <div ref="chartRef" style="width: 100%; height: 240px;"></div>
      </div>

      <div class="section-card">
        <div class="chart-title">一级分类占比</div>
        <div ref="pieChartRef" style="width: 100%; height: 240px;"></div>
      </div>

      <div v-if="statsByPlatform.length > 0" class="section-card">
        <div class="chart-title">二级分类盈亏对比</div>
        <div ref="platformChartRef" style="width: 100%; height: 240px;"></div>
      </div>

      <div class="section-card">
        <div class="chart-title">一级分类统计</div>
        <div v-for="stat in statsByType" :key="stat.type" class="stat-row">
          <span class="stat-label">{{ stat.type }}</span>
          <span class="stat-count">{{ stat.count }}条</span>
          <span :class="stat.total >= 0 ? 'amount-positive' : 'amount-negative'" style="font-weight: bold;">
            {{ stat.total >= 0 ? '+' : '' }}{{ formatAmount(stat.total) }}
          </span>
        </div>
      </div>

      <div v-if="statsByPlatform.length > 0" class="section-card">
        <div class="chart-title">二级分类统计</div>
        <div v-for="stat in statsByPlatform" :key="stat.platform" class="stat-row">
          <span class="stat-label">{{ stat.platform }}</span>
          <span class="stat-count">{{ stat.count }}条</span>
          <span :class="stat.total >= 0 ? 'amount-positive' : 'amount-negative'" style="font-weight: bold;">
            {{ stat.total >= 0 ? '+' : '' }}{{ formatAmount(stat.total) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter-bar { display: flex; flex-direction: column; gap: 10px; }
.filter-selects { display: flex; gap: 8px; }
.filter-select {
  padding: 6px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  color: #323233;
}
.summary-card { text-align: center; }
.summary-row { display: flex; justify-content: center; gap: 32px; }
.summary-item { text-align: center; }
.summary-label { font-size: 13px; color: #969799; margin-bottom: 4px; }
.chart-title { font-size: 15px; font-weight: bold; margin-bottom: 12px; }
.stat-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.stat-row:last-child { border-bottom: none; }
.stat-label { flex: 1; }
.stat-count { color: #969799; margin-right: 16px; font-size: 13px; }
</style>
