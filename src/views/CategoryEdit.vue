<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getLedger, getCategories, setCategories } from '../utils/db'
import { showConfirmDialog, showToast, showLoadingToast, closeToast } from 'vant'

const router = useRouter()
const route = useRoute()
const ledgerId = computed(() => route.params.ledgerId)

const ledger = ref(null)
const tree = ref({ income: [], expense: [] })
const direction = ref('expense')
const saving = ref(false)
const lastSavedAt = ref(0)

onMounted(async () => {
  ledger.value = await getLedger(ledgerId.value)
  tree.value = await getCategories(ledgerId.value)
})

const list = computed(() => tree.value[direction.value] || [])

function genId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

async function persist(actionLabel = '已保存') {
  saving.value = true
  try {
    await setCategories(ledgerId.value, tree.value)
    lastSavedAt.value = Date.now()
    showToast({ type: 'success', message: actionLabel, duration: 800 })
  } catch (e) {
    showToast({ type: 'fail', message: '保存失败：' + e.message })
  } finally {
    saving.value = false
  }
}

// 用不可变更新模式，确保响应式立即生效
function updateTree(updater) {
  const newTree = JSON.parse(JSON.stringify(tree.value))
  updater(newTree)
  tree.value = newTree
}

async function addPrimary() {
  const name = window.prompt('一级分类名称')
  if (!name || !name.trim()) return
  updateTree((t) => {
    if (!t[direction.value]) t[direction.value] = []
    t[direction.value].push({ id: genId(), name: name.trim(), sub: [] })
  })
  await persist('已添加')
}

async function renamePrimary(item) {
  const name = window.prompt('修改名称', item.name)
  if (!name || !name.trim() || name.trim() === item.name) return
  updateTree((t) => {
    const target = (t[direction.value] || []).find((x) => x.id === item.id)
    if (target) target.name = name.trim()
  })
  await persist('已修改')
}

async function deletePrimary(item) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: `删除一级分类"${item.name}"及其下所有二级分类？已使用此分类的旧记录不受影响。`,
    })
    updateTree((t) => {
      t[direction.value] = (t[direction.value] || []).filter((x) => x.id !== item.id)
    })
    await persist('已删除')
  } catch {}
}

async function addSecondary(item) {
  const name = window.prompt(`在"${item.name}"下新增二级分类`)
  if (!name || !name.trim()) return
  updateTree((t) => {
    const target = (t[direction.value] || []).find((x) => x.id === item.id)
    if (target) {
      if (!target.sub) target.sub = []
      target.sub.push({ id: genId(), name: name.trim() })
    }
  })
  await persist('已添加')
}

async function renameSecondary(parent, sub) {
  const name = window.prompt('修改名称', sub.name)
  if (!name || !name.trim() || name.trim() === sub.name) return
  updateTree((t) => {
    const p = (t[direction.value] || []).find((x) => x.id === parent.id)
    const s = p?.sub?.find((x) => x.id === sub.id)
    if (s) s.name = name.trim()
  })
  await persist('已修改')
}

async function deleteSecondary(parent, sub) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `删除二级分类"${sub.name}"？` })
    updateTree((t) => {
      const p = (t[direction.value] || []).find((x) => x.id === parent.id)
      if (p) p.sub = (p.sub || []).filter((x) => x.id !== sub.id)
    })
    await persist('已删除')
  } catch {}
}

async function manualSave() {
  await persist('已保存（手动）')
}

const savedTip = computed(() => {
  if (!lastSavedAt.value) return '尚未保存'
  const diff = Math.floor((Date.now() - lastSavedAt.value) / 1000)
  if (diff < 60) return `已保存（${diff} 秒前）`
  return `已保存（${Math.floor(diff / 60)} 分钟前）`
})
</script>

<template>
  <van-nav-bar
    :title="`分类编辑：${ledger?.name || ''}`"
    left-text="返回" left-arrow @click-left="router.back()"
  />
  <div class="page-container">
    <van-tabs v-model:active="direction">
      <van-tab title="支出" name="expense" />
      <van-tab title="收入" name="income" />
    </van-tabs>

    <div class="save-bar section-card">
      <span class="save-status">
        <van-icon :name="saving ? 'replay' : 'success'" :color="saving ? '#ee0a24' : '#07c160'" />
        {{ saving ? '保存中...' : savedTip }}
      </span>
      <van-button size="small" plain icon="passed" @click="manualSave">立即保存</van-button>
    </div>

    <div v-if="list.length === 0" class="empty-tip">
      <van-empty description="暂无分类，点下方按钮新建" />
    </div>

    <div v-else style="margin-top: 8px;">
      <div v-for="item in list" :key="item.id" class="cat-card section-card">
        <div class="cat-row primary">
          <div class="cat-name">{{ item.name }}</div>
          <div class="cat-actions">
            <van-button size="mini" plain @click="renamePrimary(item)">改名</van-button>
            <van-button size="mini" plain type="danger" @click="deletePrimary(item)">删除</van-button>
          </div>
        </div>
        <div class="sub-list">
          <div v-for="sub in (item.sub || [])" :key="sub.id" class="cat-row sub">
            <div class="cat-name">— {{ sub.name }}</div>
            <div class="cat-actions">
              <van-button size="mini" plain @click="renameSecondary(item, sub)">改名</van-button>
              <van-button size="mini" plain type="danger" @click="deleteSecondary(item, sub)">删除</van-button>
            </div>
          </div>
          <van-button size="small" plain icon="plus" @click="addSecondary(item)" style="width:100%; margin-top:6px;">
            添加二级分类
          </van-button>
        </div>
      </div>
    </div>

    <van-button block type="primary" icon="plus" @click="addPrimary" style="margin-top: 12px;">
      添加一级分类
    </van-button>
    <div class="hint">改动会立即自动保存，离开页面后再回来仍在。</div>
  </div>
</template>

<style scoped>
.cat-card { padding: 12px; }
.cat-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; }
.cat-row.primary { font-weight: 600; font-size: 16px; border-bottom: 1px solid #ebedf0; padding-bottom: 8px; }
.cat-row.sub { font-size: 14px; color: #646566; }
.sub-list { margin-top: 6px; padding-left: 4px; }
.cat-actions { display: flex; gap: 6px; }
.save-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; margin: 8px 0;
}
.save-status { font-size: 13px; color: #646566; display: flex; align-items: center; gap: 6px; }
.empty-tip { padding: 20px 0; }
.hint { text-align: center; font-size: 12px; color: #969799; margin-top: 12px; }
</style>
