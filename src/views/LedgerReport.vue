<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getRecordsByLedger, getCurrentLedgerId, getLedger } from '../utils/db'
import { formatAmount, formatDate } from '../utils/format'
import { showToast, showLoadingToast, closeToast } from 'vant'
import * as echarts from 'echarts'
import html2canvas from 'html2canvas'

const router = useRouter()
const ledger = ref(null)
const allRecords = ref([])
const period = ref('all')
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const reportRef = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)

const months = [1,2,3,4,5,6,7,8,9,10,11,12]

onMounted(async () => {
  const lid = await getCurrentLedgerId()
  ledger.value = await getLedger(lid)
  allRecords.value = await getRecordsByLedger(lid)
  await nextTick()
  renderCharts()
})

function signedAmount(r) { return (r.direction === 'income' ? 1 : -1) * (r.amount || 0) }
function recType(r) { return r.category1Name || r.legacyType || '未分类' }
function recPlatform(r) { return r.category2Name || r.platform || '' }

const records = computed(() => {
  if (period.value === 'all') return allRecords.value
  return allRecords.value.filter((r) => {
    const d = new Date(r.createdAt)
    if (period.value === 'year') return d.getFullYear() === selectedYear.value
    if (period.value === 'month') return d.getFullYear() === selectedYear.value && d.getMonth() + 1 === selectedMonth.value
    return true
  })
})

const periodLabel = computed(() => {
  if (period.value === 'all') return '全部时间'
  if (period.value === 'year') return `${selectedYear.value} 年度`
  if (period.value === 'month') return `${selectedYear.value} 年 ${selectedMonth.value} 月`
  return ''
})

const availableYears = computed(() => {
  const years = new Set(allRecords.value.map((r) => new Date(r.createdAt).getFullYear()))
  if (years.size === 0) years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
})

const totalProfit = computed(() => records.value.reduce((s, r) => s + signedAmount(r), 0))
const totalIn = computed(() => records.value.filter((r) => r.direction === 'income').reduce((s, r) => s + r.amount, 0))
const totalOut = computed(() => records.value.filter((r) => r.direction === 'expense').reduce((s, r) => s + r.amount, 0))

const statsByType = computed(() => {
  const map = {}
  for (const r of records.value) {
    const t = recType(r)
    if (!map[t]) map[t] = { in: 0, out: 0, count: 0 }
    map[t].count++
    if (r.direction === 'income') map[t].in += r.amount
    else map[t].out += r.amount
  }
  return Object.entries(map)
    .map(([type, d]) => ({ type, ...d, total: d.in - d.out }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
})

watch([period, selectedYear, selectedMonth], async () => {
  await nextTick()
  renderCharts()
})

function renderCharts() {
  renderPie()
  renderBar()
}

function renderPie() {
  if (!pieChartRef.value) return
  const chart = echarts.init(pieChartRef.value)
  if (records.value.length === 0) { chart.clear(); return }
  const data = statsByType.value.map((s) => ({ name: s.type, value: Math.abs(s.total) }))
  chart.setOption({
    color: ['#1989fa', '#07c160', '#ff976a', '#9c5dfa', '#f7ba2a', '#ee0a24', '#06b1ff', '#36cfc9'],
    series: [{
      type: 'pie',
      radius: ['38%', '68%'],
      data,
      label: { formatter: '{b}\n{d}%', fontSize: 12 },
    }],
  }, true)
}

function renderBar() {
  if (!barChartRef.value) return
  const chart = echarts.init(barChartRef.value)
  if (records.value.length === 0) { chart.clear(); return }
  if (period.value === 'year') {
    const monthMap = {}
    for (const r of records.value) {
      const m = new Date(r.createdAt).getMonth() + 1
      if (!monthMap[m]) monthMap[m] = 0
      monthMap[m] += signedAmount(r)
    }
    chart.setOption({
      grid: { left: 50, right: 16, top: 16, bottom: 30 },
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
  } else {
    // 累计折线
    const sorted = [...records.value].sort((a, b) => a.createdAt - b.createdAt)
    let cum = 0
    const data = sorted.map((r) => {
      cum += signedAmount(r)
      const d = new Date(r.createdAt)
      return [`${d.getMonth() + 1}/${d.getDate()}`, cum]
    })
    chart.setOption({
      grid: { left: 50, right: 16, top: 16, bottom: 30 },
      xAxis: { type: 'category', data: data.map((d) => d[0]) },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: data.map((d) => d[1]),
        smooth: true,
        areaStyle: { opacity: 0.18 },
        itemStyle: { color: data[data.length - 1]?.[1] >= 0 ? '#07c160' : '#ee0a24' },
      }],
    }, true)
  }
}

async function downloadImage() {
  if (!reportRef.value) return
  const toast = showLoadingToast({ message: '正在生成图片...', forbidClick: true })
  try {
    // 等图表渲染稳定
    await new Promise((r) => setTimeout(r, 300))
    const canvas = await html2canvas(reportRef.value, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.download = `${ledger.value?.name || '账本'}_报告_${ts}.png`
      a.click()
      URL.revokeObjectURL(url)
      closeToast()
      showToast({ type: 'success', message: '已下载到电脑' })
    }, 'image/png')
  } catch (e) {
    closeToast()
    showToast({ type: 'fail', message: '生成失败：' + e.message })
  }
}
</script>

<template>
  <van-nav-bar title="导出报告" left-text="返回" left-arrow @click-left="router.back()">
    <template #right>
      <van-button size="small" type="primary" icon="down" @click="downloadImage">下载图片</van-button>
    </template>
  </van-nav-bar>

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
      <div class="hint">下方就是导出的样子，点右上角"下载图片"保存为 PNG</div>
    </div>

    <!-- 报告内容（被截图的区域） -->
    <div ref="reportRef" class="report-card">
      <div class="report-header">
        <div class="report-title">{{ ledger?.name || '账本' }} · 收支报告</div>
        <div class="report-period">{{ periodLabel }}</div>
      </div>

      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">总盈亏</div>
          <div class="kpi-value" :class="totalProfit >= 0 ? 'positive' : 'negative'">
            {{ totalProfit >= 0 ? '+' : '' }}{{ formatAmount(totalProfit) }}
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-label">总收入</div>
          <div class="kpi-value positive">+{{ formatAmount(totalIn) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">总支出</div>
          <div class="kpi-value negative">-{{ formatAmount(totalOut) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">条数</div>
          <div class="kpi-value">{{ records.length }}</div>
        </div>
      </div>

      <div v-if="records.length === 0" class="empty-block">该时段暂无数据</div>

      <template v-else>
        <div class="report-section">
          <div class="section-title">📊 一级分类占比</div>
          <div ref="pieChartRef" class="chart-box"></div>
        </div>

        <div class="report-section">
          <div class="section-title">{{ period === 'year' ? '📈 各月盈亏' : '📈 累计盈亏走势' }}</div>
          <div ref="barChartRef" class="chart-box"></div>
        </div>

        <div class="report-section">
          <div class="section-title">📋 分类汇总</div>
          <table class="report-table">
            <thead><tr>
              <th>分类</th>
              <th class="num">条数</th>
              <th class="num">收入</th>
              <th class="num">支出</th>
              <th class="num">盈亏</th>
            </tr></thead>
            <tbody>
              <tr v-for="s in statsByType" :key="s.type">
                <td>{{ s.type }}</td>
                <td class="num">{{ s.count }}</td>
                <td class="num positive">{{ s.in ? '+' + formatAmount(s.in) : '—' }}</td>
                <td class="num negative">{{ s.out ? '-' + formatAmount(s.out) : '—' }}</td>
                <td class="num" :class="s.total >= 0 ? 'positive' : 'negative'">
                  {{ s.total >= 0 ? '+' : '' }}{{ formatAmount(s.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="report-section">
          <div class="section-title">📝 记录明细（共 {{ records.length }} 条）</div>
          <table class="report-table">
            <thead><tr>
              <th>日期</th>
              <th>方向</th>
              <th>分类</th>
              <th class="num">金额</th>
              <th>备注</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in records" :key="r.id">
                <td>{{ formatDate(r.createdAt).slice(0, 10) }}</td>
                <td :class="r.direction === 'income' ? 'positive' : 'negative'">
                  {{ r.direction === 'income' ? '收' : '支' }}
                </td>
                <td>
                  {{ recType(r) }}
                  <span v-if="recPlatform(r)" class="sub">/ {{ recPlatform(r) }}</span>
                </td>
                <td class="num" :class="r.direction === 'income' ? 'positive' : 'negative'">
                  {{ r.direction === 'income' ? '+' : '-' }}{{ formatAmount(r.amount) }}
                </td>
                <td class="note">{{ r.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div class="report-footer">
        生成时间：{{ new Date().toLocaleString('zh-CN') }} · 由 <strong>个人记账</strong> 制作
      </div>
    </div>
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
}
.hint { font-size: 12px; color: #969799; margin-top: 4px; }

.report-card {
  background: #fff;
  padding: 24px 18px;
  border-radius: 12px;
  margin-top: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.report-header {
  text-align: center;
  border-bottom: 2px solid #1989fa;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.report-title { font-size: 22px; font-weight: 700; color: #1989fa; }
.report-period { font-size: 14px; color: #646566; margin-top: 4px; }

.kpi-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
.kpi {
  background: linear-gradient(135deg, #f4f8ff, #ffffff);
  border: 1px solid #e7eefc;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.kpi-label { font-size: 12px; color: #969799; margin-bottom: 4px; }
.kpi-value { font-size: 20px; font-weight: bold; }

.report-section { margin-bottom: 18px; }
.section-title { font-size: 15px; font-weight: 600; color: #323233; margin-bottom: 8px; padding-left: 4px; border-left: 3px solid #1989fa; }
.chart-box { width: 100%; height: 240px; }

.report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.report-table th { background: #f7f8fa; color: #646566; padding: 8px; text-align: left; border-bottom: 1px solid #ebedf0; font-weight: 600; }
.report-table td { padding: 7px 8px; border-bottom: 1px solid #f0f0f0; }
.report-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.report-table .sub { color: #969799; font-size: 12px; }
.report-table .note { color: #646566; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.positive { color: #07c160; }
.negative { color: #ee0a24; }

.empty-block { text-align: center; padding: 40px 0; color: #969799; }

.report-footer { text-align: center; font-size: 12px; color: #969799; padding-top: 12px; border-top: 1px solid #ebedf0; }
</style>
