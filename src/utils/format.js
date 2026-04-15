export function formatAmount(amount) {
  const num = Number(amount)
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(timestamp) {
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(timestamp) {
  const d = new Date(timestamp)
  return `${formatDate(timestamp)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const ACCOUNT_TYPES = [
  { value: 'bank_card', label: '银行卡' },
  { value: 'fixed_deposit', label: '定期存款' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'fund', label: '基金' },
  { value: 'stock', label: '股票' },
  { value: 'insurance', label: '保险' },
  { value: 'cash', label: '现金' },
  { value: 'other', label: '其他理财' },
]

export function getAccountTypeLabel(value) {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label || value
}
