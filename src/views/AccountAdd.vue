<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addAccount } from '../utils/db'
import { ACCOUNT_TYPES } from '../utils/format'
import { showToast } from 'vant'

const route = useRoute()
const router = useRouter()
const personId = route.params.personId

const accountName = ref('')
const accountType = ref('bank_card')
const balance = ref('')
const phone = ref('')
const accountId = ref('')
const remark = ref('')
const showTypePicker = ref(false)

const typeColumns = ACCOUNT_TYPES.map((t) => ({ text: t.label, value: t.value }))
const currentTypeLabel = () => ACCOUNT_TYPES.find((t) => t.value === accountType.value)?.label

function onTypeConfirm({ selectedOptions }) {
  accountType.value = selectedOptions[0].value
  showTypePicker.value = false
}

async function onSubmit() {
  const name = accountName.value.trim()
  if (!name) { showToast('请输入账户名称'); return }
  const bal = parseFloat(balance.value) || 0
  await addAccount({
    personId,
    name,
    type: accountType.value,
    balance: bal,
    phone: phone.value.trim(),
    accountId: accountId.value.trim(),
    remark: remark.value.trim(),
  })
  showToast('添加成功')
  router.back()
}
</script>

<template>
  <van-nav-bar title="添加账户" left-text="返回" left-arrow @click-left="router.back()" />
  <div class="page-container">
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="accountName" label="名称" placeholder="如：工商银行储蓄卡"
          :rules="[{ required: true, message: '请输入名称' }]" />
        <van-field :model-value="currentTypeLabel()" is-link readonly label="类型" @click="showTypePicker = true" />
        <van-field v-model="balance" type="number" label="当前余额" placeholder="请输入当前余额" />
        <van-field v-model="phone" type="tel" label="绑定手机" placeholder="可选" />
        <van-field v-model="accountId" label="账户名" placeholder="可选，如登录账号" />
        <van-field v-model="remark" label="备注" placeholder="可选" type="textarea" rows="2" autosize />
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button round block type="primary" native-type="submit">保存</van-button>
      </div>
    </van-form>
  </div>
  <van-popup v-model:show="showTypePicker" position="bottom" round>
    <van-picker :columns="typeColumns" @confirm="onTypeConfirm" @cancel="showTypePicker = false" />
  </van-popup>
</template>
