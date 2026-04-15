<script setup>
import { ref, onMounted } from 'vue'
import { exportAllData, importAllData, clearAllData, getGameTypes, setGameTypes, getPlatforms, setPlatforms } from '../utils/db'
import { showConfirmDialog, showDialog, showToast, showLoadingToast, closeToast } from 'vant'
import * as XLSX from 'xlsx'

const gameTypes = ref([])
const platforms = ref([])
const showAddType = ref(false)
const showAddPlatform = ref(false)
const newTypeName = ref('')
const newPlatformName = ref('')

onMounted(async () => {
  gameTypes.value = await getGameTypes()
  platforms.value = await getPlatforms()
})

// ========== 游戏类型管理 ==========
async function handleAddType() {
  const name = newTypeName.value.trim()
  if (!name) { showToast('请输入类型名称'); return }
  if (gameTypes.value.includes(name)) { showToast('该类型已存在'); return }
  gameTypes.value.push(name)
  await setGameTypes(gameTypes.value)
  newTypeName.value = ''
  showAddType.value = false
}

async function handleDeleteType(index) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除游戏类型"${gameTypes.value[index]}"？` })
    gameTypes.value.splice(index, 1)
    await setGameTypes(gameTypes.value)
  } catch {}
}

// ========== 平台管理 ==========
async function handleAddPlatform() {
  const name = newPlatformName.value.trim()
  if (!name) { showToast('请输入平台名称'); return }
  if (platforms.value.includes(name)) { showToast('该平台已存在'); return }
  platforms.value.push(name)
  await setPlatforms(platforms.value)
  newPlatformName.value = ''
  showAddPlatform.value = false
}

async function handleDeletePlatform(index) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除平台"${platforms.value[index]}"？` })
    platforms.value.splice(index, 1)
    await setPlatforms(platforms.value)
  } catch {}
}

// ========== 数据管理 ==========
async function handleExportJSON() {
  const data = await exportAllData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `记账数据_${formatDateForFile()}.json`)
  showToast('导出成功')
}

async function handleExportExcel() {
  const data = await exportAllData()
  const wb = XLSX.utils.book_new()

  if (data.gameRecords.length) {
    const rows = data.gameRecords.map((r) => ({
      日期: new Date(r.createdAt).toLocaleString('zh-CN'),
      类型: r.type,
      平台: r.platform || '',
      金额: r.amount,
      备注: r.note || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '游戏收支')
  }

  if (data.accounts.length) {
    const personMap = {}
    for (const p of data.persons) personMap[p.id] = p.name
    const rows = data.accounts.map((a) => ({
      所属人: personMap[a.personId] || '',
      账户名: a.name,
      类型: a.type,
      余额: a.balance || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '账户列表')
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  downloadBlob(blob, `记账数据_${formatDateForFile()}.xlsx`)
  showToast('导出成功')
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      showLoadingToast({ message: '导入中...', forbidClick: true })
      await importAllData(data)
      closeToast()
      showToast('导入成功，请刷新页面')
    } catch {
      showToast('导入失败，文件格式不正确')
    }
  }
  input.click()
}

async function handleClear() {
  try {
    await showConfirmDialog({
      title: '清空所有数据',
      message: '此操作将删除所有记录，不可恢复！建议先导出备份。',
    })
    await clearAllData()
    showToast('已清空')
    gameTypes.value = await getGameTypes()
    platforms.value = await getPlatforms()
  } catch {}
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatDateForFile() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="page-container">
    <div class="section-card" style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">个人记账</div>
      <div style="font-size: 13px; color: #969799;">数据存储在本地，注意定期备份</div>
    </div>

    <!-- 游戏类型管理 -->
    <van-cell-group inset title="游戏类型">
      <van-swipe-cell v-for="(type, index) in gameTypes" :key="type">
        <van-cell :title="type" />
        <template #right>
          <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDeleteType(index)" />
        </template>
      </van-swipe-cell>
      <van-cell title="添加类型" is-link @click="showAddType = true" />
    </van-cell-group>

    <!-- 德州平台管理 -->
    <van-cell-group inset title="德州扑克平台" style="margin-top: 12px;">
      <van-swipe-cell v-for="(p, index) in platforms" :key="p">
        <van-cell :title="p" />
        <template #right>
          <van-button square type="danger" text="删除" style="height: 100%;" @click="handleDeletePlatform(index)" />
        </template>
      </van-swipe-cell>
      <van-cell title="添加平台" is-link @click="showAddPlatform = true" />
    </van-cell-group>

    <!-- 数据管理 -->
    <van-cell-group inset title="数据管理" style="margin-top: 12px;">
      <van-cell title="导出 JSON 备份" is-link @click="handleExportJSON" />
      <van-cell title="导出 Excel" is-link @click="handleExportExcel" />
      <van-cell title="导入 JSON 备份" is-link @click="handleImport" />
      <van-cell title="清空所有数据" is-link @click="handleClear" title-style="color: #ee0a24;" />
    </van-cell-group>
  </div>

  <van-dialog v-model:show="showAddType" title="添加游戏类型" show-cancel-button @confirm="handleAddType">
    <van-field v-model="newTypeName" placeholder="请输入类型名称" style="margin: 16px;" />
  </van-dialog>

  <van-dialog v-model:show="showAddPlatform" title="添加平台" show-cancel-button @confirm="handleAddPlatform">
    <van-field v-model="newPlatformName" placeholder="请输入平台名称" style="margin: 16px;" />
  </van-dialog>
</template>
