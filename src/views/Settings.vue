<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  exportAllDataV2 as exportAllData,
  importAllDataV2 as importAllData,
  clearAllDataV2 as clearAllData,
  getGameTypes, setGameTypes, getPlatforms, setPlatforms,
  getLedgers, addLedger, updateLedger, deleteLedger,
} from '../utils/db'
import { showConfirmDialog, showDialog, showToast, showLoadingToast, closeToast } from 'vant'
import * as XLSX from 'xlsx'

const router = useRouter()

const importFileInput = ref(null)
const showPasteImport = ref(false)
const pasteText = ref('')

const gameTypes = ref([])
const platforms = ref([])
const ledgers = ref([])
const showAddType = ref(false)
const showAddPlatform = ref(false)
const showAddLedger = ref(false)
const newTypeName = ref('')
const newPlatformName = ref('')
const newLedgerName = ref('')

onMounted(async () => {
  gameTypes.value = await getGameTypes()
  platforms.value = await getPlatforms()
  ledgers.value = await getLedgers()
})

// ========== 账本管理 ==========
async function handleAddLedger() {
  const name = newLedgerName.value.trim()
  if (!name) { showToast('请输入账本名称'); return }
  if (ledgers.value.some((l) => l.name === name)) { showToast('已存在同名账本'); return }
  await addLedger(name)
  newLedgerName.value = ''
  showAddLedger.value = false
  ledgers.value = await getLedgers()
  showToast('账本已添加')
}

async function handleRenameLedger(l) {
  const name = window.prompt('修改账本名称', l.name)
  if (!name || !name.trim() || name.trim() === l.name) return
  await updateLedger(l.id, { name: name.trim() })
  ledgers.value = await getLedgers()
}

async function handleDeleteLedger(l) {
  try {
    await showConfirmDialog({
      title: '确认删除账本',
      message: `删除"${l.name}"会一并清空它的所有记录和分类。不可恢复。`,
    })
    await deleteLedger(l.id)
    ledgers.value = await getLedgers()
    showToast('已删除')
  } catch {}
}

function openCategoryEdit(l) {
  router.push(`/settings/categories/${l.id}`)
}

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

  // 多账本记录：按账本分 sheet
  const ledgerById = {}
  for (const l of (data.ledgers || [])) ledgerById[l.id] = l
  const grouped = {}
  for (const r of (data.records || [])) {
    const lname = ledgerById[r.ledgerId]?.name || r.ledgerId
    if (!grouped[lname]) grouped[lname] = []
    grouped[lname].push({
      日期: new Date(r.createdAt).toLocaleString('zh-CN'),
      方向: r.direction === 'income' ? '收入' : '支出',
      一级分类: r.category1Name || r.legacyType || '',
      二级分类: r.category2Name || '',
      平台: r.platform || '',
      金额: r.amount,
      备注: r.note || '',
    })
  }
  for (const [name, rows] of Object.entries(grouped)) {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }
  // 兼容老 gameRecords（如果迁移漏了）
  if (data.gameRecords?.length && !grouped['游戏收支']) {
    const rows = data.gameRecords.map((r) => ({
      日期: new Date(r.createdAt).toLocaleString('zh-CN'),
      类型: r.type,
      平台: r.platform || '',
      金额: r.amount,
      备注: r.note || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '游戏收支(旧)')
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

function triggerFileImport() {
  importFileInput.value?.click()
}

async function onImportFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    await processImportText(text)
  } catch (err) {
    showToast('文件读取失败：' + (err?.message || ''))
  } finally {
    if (e.target) e.target.value = ''  // reset 让同一文件可重选
  }
}

async function handlePasteImport() {
  const text = pasteText.value.trim()
  if (!text) { showToast('请粘贴 JSON 内容'); return }
  try {
    await processImportText(text)
    showPasteImport.value = false
    pasteText.value = ''
  } catch (err) {
    /* processImportText 内部会 toast */
  }
}

async function processImportText(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    showToast('JSON 解析失败，文件格式不正确')
    return
  }
  const ledgers = data.ledgers || []
  const records = data.records || []
  const recordsByLedger = {}
  for (const r of records) {
    const lid = r.ledgerId || '(unknown)'
    recordsByLedger[lid] = (recordsByLedger[lid] || 0) + 1
  }
  const ledgerLines = ledgers.length
    ? ledgers.map((l) => `  • ${l.name}：${recordsByLedger[l.id] || 0} 条记录${data.ledgerCategories?.[l.id] ? '（含分类树）' : '（无分类）'}`).join('\n')
    : '  （无）'
  const orphanRecords = records.filter((r) => !ledgers.find((l) => l.id === r.ledgerId)).length
  const previewMsg =
    `JSON 内容预览（导入前）：\n\n` +
    `账本：${ledgers.length}\n` +
    `${ledgerLines}\n\n` +
    `游戏记录(老)：${(data.gameRecords || []).length}\n` +
    `账户：${(data.accounts || []).length}\n` +
    (orphanRecords > 0 ? `⚠️ 孤立记录（自动重建账本）：${orphanRecords}\n` : '') +
    `\n继续导入？（不会删除现有数据，仅覆盖同 ID 项）`
  console.log('[Import] 文件内容', { ledgers, records: records.length, recordsByLedger })
  try {
    await showConfirmDialog({
      title: '导入预览',
      message: previewMsg,
      messageAlign: 'left',
      confirmButtonText: '继续导入',
      cancelButtonText: '取消',
    })
  } catch { return }
  showLoadingToast({ message: '导入中（手机大数据可能稍慢）...', forbidClick: true })
  const result = await importAllData(data)
  closeToast()
  const recoveredMsg = (result?.recovered?.length)
    ? `\n\n⚙️ 自动恢复了 ${result.recovered.length} 个丢失的账本（请去"账本管理"改名）`
    : ''
  showDialog({
    title: '导入完成',
    message: '点确认后会刷新页面以加载新数据。' + recoveredMsg,
    messageAlign: 'left',
  }).then(() => {
    window.location.reload()
  })
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

    <!-- 账本管理 -->
    <van-cell-group inset title="账本管理">
      <div v-for="l in ledgers" :key="l.id" class="ledger-row">
        <div class="ledger-row-main">
          <van-icon :name="l.icon || 'balance-o'" size="18" />
          <span class="ledger-row-name">{{ l.name }}</span>
          <van-tag v-if="l.builtIn" size="small" plain>内置</van-tag>
        </div>
        <div class="ledger-row-actions">
          <van-button size="mini" plain @click="openCategoryEdit(l)">分类</van-button>
          <van-button size="mini" plain @click="handleRenameLedger(l)">改名</van-button>
          <van-button size="mini" plain type="danger" :disabled="l.builtIn" @click="handleDeleteLedger(l)">删除</van-button>
        </div>
      </div>
      <van-cell title="添加账本" is-link @click="showAddLedger = true" />
    </van-cell-group>

    <!-- 提示：游戏类型/平台已并入"游戏收支"账本的分类树 -->
    <van-notice-bar wrapable :scrollable="false" left-icon="info-o" style="margin-top: 12px;">
      游戏类型与平台已合并到"游戏收支"账本的分类。
      点上方账本管理里 <strong>游戏收支</strong> 行的"分类"按钮编辑：
      texas / lot 是一级分类，texas 下的子项是平台。
    </van-notice-bar>

    <!-- 数据管理 -->
    <van-cell-group inset title="数据管理" style="margin-top: 12px;">
      <van-cell title="导出 JSON 备份" is-link @click="handleExportJSON" />
      <van-cell title="导出 Excel" is-link @click="handleExportExcel" />
      <van-cell title="导入 JSON 备份（选文件）" is-link @click="triggerFileImport" />
      <input
        ref="importFileInput"
        type="file"
        accept="application/json,.json,text/plain,*/*"
        style="display:none"
        @change="onImportFileSelected"
      >
      <van-cell title="导入 JSON 备份（粘贴文本）" is-link @click="showPasteImport = true" />
      <van-cell title="清空所有数据" is-link @click="handleClear" title-style="color: #ee0a24;" />
    </van-cell-group>
  </div>

  <van-popup v-model:show="showPasteImport" position="bottom" round closeable :style="{ height: '70%' }">
    <div style="padding: 20px;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">粘贴 JSON 备份</div>
      <div style="font-size: 12px; color: #969799; margin-bottom: 12px;">
        手机上文件选择不灵时用这个：把 JSON 内容复制到剪贴板，在下方文本框长按粘贴。
      </div>
      <van-field
        v-model="pasteText"
        type="textarea"
        rows="10"
        placeholder='这里粘贴 JSON 内容，以 { 开头'
        style="background:#f7f8fa; border-radius:8px;"
      />
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <van-button block plain @click="showPasteImport = false">取消</van-button>
        <van-button block type="primary" @click="handlePasteImport">导入</van-button>
      </div>
    </div>
  </van-popup>

  <van-dialog v-model:show="showAddLedger" title="新建账本" show-cancel-button @confirm="handleAddLedger">
    <van-field v-model="newLedgerName" placeholder="如：日常开支 / AI 基金" style="margin: 16px;" />
    <div style="margin: 0 16px 16px; font-size: 12px; color: #969799;">
      新建后会自动初始化默认收入/支出分类，可点"分类"按钮自定义。
    </div>
  </van-dialog>
</template>

<style scoped>
.ledger-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid #ebedf0;
}
.ledger-row:last-of-type { border-bottom: none; }
.ledger-row-main { display: flex; align-items: center; gap: 8px; }
.ledger-row-name { font-size: 15px; }
.ledger-row-actions { display: flex; gap: 4px; }
</style>
