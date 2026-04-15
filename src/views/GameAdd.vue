<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { addGameRecord, getGameTypes, getPlatforms } from '../utils/db'
import { showToast } from 'vant'

const router = useRouter()

const gameTypes = ref([])
const platforms = ref([])
const gameType = ref('')
const platform = ref('')
const direction = ref('lose')
const amount = ref('')
const note = ref('')
const recordDate = ref(new Date())
const showTypePicker = ref(false)
const showPlatformPicker = ref(false)
const showDatePicker = ref(false)

onMounted(async () => {
  gameTypes.value = await getGameTypes()
  platforms.value = await getPlatforms()
  gameType.value = gameTypes.value[0] || ''
  platform.value = platforms.value[0] || ''
})

const isTexas = () => gameType.value === '德州扑克'

const typeColumns = () => gameTypes.value.map((t) => ({ text: t, value: t }))
const platformColumns = () => platforms.value.map((t) => ({ text: t, value: t }))

function onTypeConfirm({ selectedOptions }) {
  gameType.value = selectedOptions[0].value
  showTypePicker.value = false
}

function onPlatformConfirm({ selectedOptions }) {
  platform.value = selectedOptions[0].value
  showPlatformPicker.value = false
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

async function onSubmit() {
  const num = parseFloat(amount.value)
  if (isNaN(num) || num <= 0) {
    showToast('请输入有效金额')
    return
  }
  const finalAmount = direction.value === 'win' ? num : -num
  const record = {
    type: gameType.value,
    amount: finalAmount,
    note: note.value.trim(),
    createdAt: recordDate.value.getTime(),
  }
  if (isTexas()) {
    record.platform = platform.value
  }
  await addGameRecord(record)
  showToast('记录成功')
  router.back()
}
</script>

<template>
  <van-nav-bar title="记一笔" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field
          :model-value="gameType"
          is-link
          readonly
          label="类型"
          placeholder="选择游戏类型"
          @click="showTypePicker = true"
        />
        <van-field
          v-if="isTexas()"
          :model-value="platform"
          is-link
          readonly
          label="平台"
          placeholder="选择平台"
          @click="showPlatformPicker = true"
        />
        <van-field
          :model-value="formatDateDisplay()"
          is-link
          readonly
          label="日期"
          @click="showDatePicker = true"
        />
        <van-field label="收支方向">
          <template #input>
            <van-radio-group v-model="direction" direction="horizontal">
              <van-radio name="win">收入</van-radio>
              <van-radio name="lose">支出</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          v-model="amount"
          type="number"
          label="金额"
          placeholder="请输入金额"
          :rules="[{ required: true, message: '请输入金额' }]"
        />
        <van-field v-model="note" label="备注" placeholder="可选" />
      </van-cell-group>

      <div style="margin: 16px;">
        <van-button round block type="primary" native-type="submit">保存</van-button>
      </div>
    </van-form>
  </div>

  <van-popup v-model:show="showTypePicker" position="bottom" round>
    <van-picker :columns="typeColumns()" @confirm="onTypeConfirm" @cancel="showTypePicker = false" />
  </van-popup>
  <van-popup v-model:show="showPlatformPicker" position="bottom" round>
    <van-picker :columns="platformColumns()" @confirm="onPlatformConfirm" @cancel="showPlatformPicker = false" />
  </van-popup>
  <van-popup v-model:show="showDatePicker" position="bottom" round>
    <van-date-picker
      :model-value="[String(recordDate.getFullYear()), String(recordDate.getMonth() + 1).padStart(2, '0'), String(recordDate.getDate()).padStart(2, '0')]"
      title="选择日期"
      :min-date="new Date(2020, 0, 1)"
      :max-date="new Date()"
      @confirm="onDateConfirm"
      @cancel="showDatePicker = false"
    />
  </van-popup>
</template>
