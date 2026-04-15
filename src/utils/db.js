import localforage from 'localforage'

const gameStore = localforage.createInstance({ name: 'accounting', storeName: 'game_records' })
const personStore = localforage.createInstance({ name: 'accounting', storeName: 'persons' })
const accountStore = localforage.createInstance({ name: 'accounting', storeName: 'accounts' })
const balanceStore = localforage.createInstance({ name: 'accounting', storeName: 'balance_records' })
const configStore = localforage.createInstance({ name: 'accounting', storeName: 'config' })

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ========== 游戏收支 ==========

export async function addGameRecord(record) {
  const id = genId()
  const data = { id, createdAt: Date.now(), ...record }
  await gameStore.setItem(id, data)
  return data
}

export async function getGameRecords() {
  const records = []
  await gameStore.iterate((value) => { records.push(value) })
  return records.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteGameRecord(id) {
  await gameStore.removeItem(id)
}

export async function updateGameRecord(id, updates) {
  const record = await gameStore.getItem(id)
  if (!record) return null
  const updated = { ...record, ...updates }
  await gameStore.setItem(id, updated)
  return updated
}

// ========== 人员 ==========

export async function getPersons() {
  const persons = []
  await personStore.iterate((value) => { persons.push(value) })
  return persons.sort((a, b) => a.order - b.order)
}

export async function addPerson(name) {
  const id = genId()
  const persons = await getPersons()
  const data = { id, name, order: persons.length }
  await personStore.setItem(id, data)
  return data
}

export async function deletePerson(id) {
  await personStore.removeItem(id)
  // 删除该人员下所有账户和记录
  const accounts = await getAccountsByPerson(id)
  for (const acc of accounts) {
    await deleteAccount(acc.id)
  }
}

export async function updatePerson(id, updates) {
  const person = await personStore.getItem(id)
  if (!person) return null
  const updated = { ...person, ...updates }
  await personStore.setItem(id, updated)
  return updated
}

// ========== 账户 ==========

export async function getAccountsByPerson(personId) {
  const accounts = []
  await accountStore.iterate((value) => {
    if (value.personId === personId) accounts.push(value)
  })
  return accounts.sort((a, b) => a.order - b.order)
}

export async function getAllAccounts() {
  const accounts = []
  await accountStore.iterate((value) => { accounts.push(value) })
  return accounts
}

export async function addAccount(account) {
  const id = genId()
  const personAccounts = await getAccountsByPerson(account.personId)
  const data = { id, order: personAccounts.length, createdAt: Date.now(), ...account }
  await accountStore.setItem(id, data)
  return data
}

export async function getAccount(id) {
  return accountStore.getItem(id)
}

export async function updateAccount(id, updates) {
  const account = await accountStore.getItem(id)
  if (!account) return null
  const updated = { ...account, ...updates, updatedAt: Date.now() }
  await accountStore.setItem(id, updated)
  return updated
}

export async function deleteAccount(id) {
  await accountStore.removeItem(id)
  // 删除该账户下所有余额记录
  const records = await getBalanceRecords(id)
  for (const r of records) {
    await balanceStore.removeItem(r.id)
  }
}

// ========== 余额记录 ==========

export async function getBalanceRecords(accountId) {
  const records = []
  await balanceStore.iterate((value) => {
    if (value.accountId === accountId) records.push(value)
  })
  return records.sort((a, b) => b.createdAt - a.createdAt)
}

export async function addBalanceRecord(record) {
  const id = genId()
  const data = { id, createdAt: Date.now(), ...record }
  await balanceStore.setItem(id, data)
  // 更新账户当前余额
  await updateAccount(record.accountId, { balance: record.balance })
  return data
}

export async function deleteBalanceRecord(id) {
  await balanceStore.removeItem(id)
}

// ========== 导出 ==========

export async function exportAllData() {
  const data = { gameRecords: [], persons: [], accounts: [], balanceRecords: [], config: {} }
  await gameStore.iterate((v) => { data.gameRecords.push(v) })
  await personStore.iterate((v) => { data.persons.push(v) })
  await accountStore.iterate((v) => { data.accounts.push(v) })
  await balanceStore.iterate((v) => { data.balanceRecords.push(v) })
  await configStore.iterate((v, k) => { data.config[k] = v })
  return data
}

export async function importAllData(data) {
  if (data.gameRecords) {
    for (const r of data.gameRecords) await gameStore.setItem(r.id, r)
  }
  if (data.persons) {
    for (const r of data.persons) await personStore.setItem(r.id, r)
  }
  if (data.accounts) {
    for (const r of data.accounts) await accountStore.setItem(r.id, r)
  }
  if (data.balanceRecords) {
    for (const r of data.balanceRecords) await balanceStore.setItem(r.id, r)
  }
  if (data.config) {
    for (const [k, v] of Object.entries(data.config)) await configStore.setItem(k, v)
  }
}

export async function clearAllData() {
  await gameStore.clear()
  await personStore.clear()
  await accountStore.clear()
  await balanceStore.clear()
  await configStore.clear()
}

// ========== 配置 ==========

const DEFAULT_GAME_TYPES = ['texas', 'lot']
const DEFAULT_PLATFORMS = ['红龙', 'GG', '线下', 'DPC']

export async function getConfig(key, defaultValue) {
  const val = await configStore.getItem(key)
  return val !== null ? val : defaultValue
}

export async function setConfig(key, value) {
  await configStore.setItem(key, value)
}

export async function getGameTypes() {
  return getConfig('gameTypes', DEFAULT_GAME_TYPES)
}

export async function setGameTypes(types) {
  return setConfig('gameTypes', types)
}

export async function getPlatforms() {
  return getConfig('platforms', DEFAULT_PLATFORMS)
}

export async function setPlatforms(platforms) {
  return setConfig('platforms', platforms)
}

// 初始化默认人员
export async function initDefaultPersons() {
  const persons = await getPersons()
  if (persons.length === 0) {
    await addPerson('我')
    await addPerson('父亲')
    await addPerson('母亲')
  }
}
