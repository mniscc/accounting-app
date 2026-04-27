<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getLedgers, getCurrentLedgerId, setCurrentLedgerId,
  getCategories, addRecord,
} from '../utils/db'
import { showToast } from 'vant'

const router = useRouter()

const ledgers = ref([])
const ledgerId = ref('')
const categories = ref({ income: [], expense: [] })

const direction = ref('expense')
const cat1Id = ref('')
const cat2Id = ref('')
const amount = ref('')
const note = ref('')
const recordDate = ref(new Date())

const showLedgerPicker = ref(false)
const showCat1Picker = ref(false)
const showCat2Picker = ref(false)
const showDatePicker = ref(false)

const currentLedger = computed(() => ledgers.value.find((l) => l.id === ledgerId.value))

const directionList = computed(() => categories.value[direction.value] || [])
const cat1 = computed(() => directionList.value.find((c) => c.id === cat1Id.value))
const cat2List = computed(() => cat1.value?.sub || [])
const cat2 = computed(() => cat2List.value.find((c) => c.id === cat2Id.value))

onMounted(async () => {
  ledgers.value = await getLedgers()
  ledgerId.value = await getCurrentLedgerId()
  if (!ledgers.value.some((l) => l.id === ledgerId.value)) {
    ledgerId.value = ledgers.value[0]?.id || ''
  }
  await loadCategories()
})

async function loadCategories() {
  if (!ledgerId.value) return
  categories.value = await getCategories(ledgerId.value)
  // 默认选第一个分类
  cat1Id.value = directionList.value[0]?.id || ''
  cat2Id.value = ''
}

function onDirectionChange() {
  cat1Id.value = directionList.value[0]?.id || ''
  cat2Id.value = ''
}

async function onLedgerConfirm({ selectedOptions }) {
  ledgerId.value = selectedOptions[0].value
  await setCurrentLedgerId(ledgerId.value)
  await loadCategories()
  showLedgerPicker.value = false
}

function onCat1Confirm({ selectedOptions }) {
  cat1Id.value = selectedOptions[0].value
  cat2Id.value = ''
  showCat1Picker.value = false
}

function onCat2Confirm({ selectedOptions }) {
  cat2Id.value = selectedOptions[0].value
  showCat2Picker.value = false
}

function onDateConfirm({ selectedValues }) {
  const [y, m, d] = selectedValues
  recordDate.value = new Date(y, m - 1, d)
  showDatePicker.value = false
}

function formatDateDisplay() {
  const d = recordDate.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ledgerColumns = computed(() => ledgers.value.map((l) => ({ text: l.name, value: l.id })))
const cat1Columns = computed(() => directionList.value.map((c) => ({ text: c.name, value: c.id })))
const cat2Columns = computed(() => cat2List.value.map((c) => ({ text: c.name, value: c.id })))

async function onSubmit() {
  const num = parseFloat(amount.value)
  if (isNaN(num) || num <= 0) {
    showToast('请输入有效金额')
    return
  }
  if (!cat1Id.value) {
    showToast('请选择一级分类')
    return
  }
  const record = {
    ledgerId: ledgerId.value,
    direction: direction.value,
    category1: cat1Id.value,
    category1Name: cat1.value?.name || '',
    category2: cat2Id.value || '',
    category2Name: cat2.value?.name || '',
    amount: num,
    note: note.value.trim(),
    createdAt: recordDate.value.getTime(),
  }
  await addRecord(record)
  showToast('记录成功')
  router.back()
}
</script>

<template>
  <van-nav-bar title="记一笔" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <van-form @submit="onSubmit">
      <van-cell-group inset title="记账信息">
        <van-field
          :model-value="currentLedger?.name || ''"
          is-link readonly label="账本"
          placeholder="选择账本" @click="showLedgerPicker = true"
        />
        <van-field label="收支方向">
          <template #input>
            <van-radio-group v-model="direction" direction="horizontal" @change="onDirectionChange">
              <van-radio name="income">收入</van-radio>
              <van-radio name="expense">支出</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          :model-value="cat1?.name || ''"
          is-link readonly label="一级分类"
          placeholder="选择" @click="showCat1Picker = true"
        />
        <van-field
          v-if="cat2List.length > 0"
          :model-value="cat2?.name || ''"
          is-link readonly label="二级分类"
          placeholder="可选" @click="showCat2Picker = true"
        />
        <van-field
          :model-value="formatDateDisplay()"
          is-link readonly label="日期" @click="showDatePicker = true"
        />
        <van-field
          v-model="amount" type="number" label="金额"
          placeholder="请输入金额"
          :rules="[{ required: true, message: '请输入金额' }]"
        />
        <van-field v-model="note" label="备注" placeholder="可选" />
      </van-cell-group>

      <div style="margin: 16px;">
        <van-button round block type="primary" native-type="submit">保存</van-button>
      </div>
      <div class="hint" style="text-align:center; margin: 8px 16px 0; font-size:12px; color:#969799;">
        分类不够用？到 <van-button size="mini" plain @click.prevent="router.push('/settings')">设置</van-button> 编辑当前账本的分类。
      </div>
    </van-form>
  </div>

  <van-popup v-model:show="showLedgerPicker" position="bottom" round>
    <van-picker :columns="ledgerColumns" @confirm="onLedgerConfirm" @cancel="showLedgerPicker = false" />
  </van-popup>
  <van-popup v-model:show="showCat1Picker" position="bottom" round>
    <van-picker :columns="cat1Columns" @confirm="onCat1Confirm" @cancel="showCat1Picker = false" />
  </van-popup>
  <van-popup v-model:show="showCat2Picker" position="bottom" round>
    <van-picker :columns="cat2Columns" @confirm="onCat2Confirm" @cancel="showCat2Picker = false" />
  </van-popup>
  <van-popup v-model:show="showDatePicker" position="bottom" round>
    <van-date-picker
      :model-value="[String(recordDate.getFullYear()), String(recordDate.getMonth() + 1).padStart(2, '0'), String(recordDate.getDate()).padStart(2, '0')]"
      title="选择日期"
      :min-date="new Date(2020, 0, 1)"
      :max-date="new Date()"
      @confirm="onDateConfirm" @cancel="showDatePicker = false"
    />
  </van-popup>
</template>
