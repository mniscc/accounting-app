import localforage from 'localforage'

const gameStore = localforage.createInstance({ name: 'accounting', storeName: 'game_records' })
const personStore = localforage.createInstance({ name: 'accounting', storeName: 'persons' })
const accountStore = localforage.createInstance({ name: 'accounting', storeName: 'accounts' })
const balanceStore = localforage.createInstance({ name: 'accounting', storeName: 'balance_records' })
const configStore = localforage.createInstance({ name: 'accounting', storeName: 'config' })
const ledgerStore = localforage.createInstance({ name: 'accounting', storeName: 'ledgers' })
const recordStore = localforage.createInstance({ name: 'accounting', storeName: 'records' })

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
  // 并行写入加快速度（localforage 内部排队，但能避免每次 await 的额外往返延迟）
  const tasks = []
  if (data.gameRecords) for (const r of data.gameRecords) tasks.push(gameStore.setItem(r.id, r))
  if (data.persons) for (const r of data.persons) tasks.push(personStore.setItem(r.id, r))
  if (data.accounts) for (const r of data.accounts) tasks.push(accountStore.setItem(r.id, r))
  if (data.balanceRecords) for (const r of data.balanceRecords) tasks.push(balanceStore.setItem(r.id, r))
  if (data.config) for (const [k, v] of Object.entries(data.config)) tasks.push(configStore.setItem(k, v))
  await Promise.all(tasks)
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

// ========== 账本（多账本支持） ==========

const GAME_LEDGER_ID = 'L_GAME'

const DEFAULT_LEDGERS = [
  { id: GAME_LEDGER_ID, name: '游戏收支', icon: 'balance-o', builtIn: true, hasPlatform: true },
]

const DEFAULT_CATEGORIES = {
  // 通用账本默认结构 —— 空白，由用户自行添加
  generic: {
    income: [],
    expense: [],
  },
}

// 根据游戏类型 + 平台 动态生成游戏账本默认分类（texas 含平台二级，lot 无）
function buildGameCategories(gameTypes, platforms) {
  const types = (gameTypes && gameTypes.length) ? gameTypes : ['texas', 'lot']
  const plats = platforms || []
  const buildSide = () => types.map((t) => {
    const subs = (t.toLowerCase() === 'texas') ? plats.map((p, i) => ({ id: `g_${t}_${i}_${p}`, name: p })) : []
    return { id: `g_${t}`, name: t, sub: subs }
  })
  return { income: buildSide(), expense: buildSide() }
}

export async function getLedgers() {
  const all = []
  await ledgerStore.iterate((v) => { all.push(v) })
  return all.sort((a, b) => (a.order || 0) - (b.order || 0))
}

export async function getLedger(id) {
  return ledgerStore.getItem(id)
}

export async function addLedger(name, options = {}) {
  const id = options.id || ('L_' + genId())
  const ledgers = await getLedgers()
  const data = {
    id, name,
    icon: options.icon || 'balance-o',
    order: ledgers.length,
    builtIn: options.builtIn === true,
    hasPlatform: options.hasPlatform === true,
    createdAt: Date.now(),
  }
  await ledgerStore.setItem(id, data)
  // 初始化默认分类
  const cat = options.categories || DEFAULT_CATEGORIES.generic
  await setCategories(id, cat)
  return data
}

export async function updateLedger(id, updates) {
  const l = await ledgerStore.getItem(id)
  if (!l) return null
  const updated = { ...l, ...updates, updatedAt: Date.now() }
  await ledgerStore.setItem(id, updated)
  return updated
}

export async function deleteLedger(id) {
  // 删除账本及其所有记录、分类
  await ledgerStore.removeItem(id)
  await configStore.removeItem('cats_' + id)
  // 删该账本下记录
  const ids = []
  await recordStore.iterate((r) => { if (r.ledgerId === id) ids.push(r.id) })
  for (const rid of ids) await recordStore.removeItem(rid)
}

// ========== 分类（按账本存）==========

export async function getCategories(ledgerId) {
  const stored = await configStore.getItem('cats_' + ledgerId)
  if (stored) return stored
  // 游戏账本的默认分类来自当前的"游戏类型 + 平台"列表
  if (ledgerId === GAME_LEDGER_ID) {
    const types = await getGameTypes()
    const plats = await getPlatforms()
    return buildGameCategories(types, plats)
  }
  const def = DEFAULT_CATEGORIES[ledgerId] || DEFAULT_CATEGORIES.generic
  return JSON.parse(JSON.stringify(def))
}

export async function setCategories(ledgerId, tree) {
  // 序列化为普通对象，避免 Vue 响应式代理被存进 IndexedDB 失败
  const plain = JSON.parse(JSON.stringify(tree))
  await configStore.setItem('cats_' + ledgerId, plain)
}

// ========== 通用记录（账本内）==========

export async function getRecordsByLedger(ledgerId) {
  const list = []
  await recordStore.iterate((r) => { if (r.ledgerId === ledgerId) list.push(r) })
  return list.sort((a, b) => b.createdAt - a.createdAt)
}

export async function addRecord(record) {
  const id = genId()
  const data = { id, createdAt: Date.now(), ...record }
  await recordStore.setItem(id, data)
  return data
}

export async function updateRecord(id, updates) {
  const r = await recordStore.getItem(id)
  if (!r) return null
  const updated = { ...r, ...updates, updatedAt: Date.now() }
  await recordStore.setItem(id, updated)
  return updated
}

export async function deleteRecord(id) {
  await recordStore.removeItem(id)
}

// ========== 当前选中账本 ==========

export async function getCurrentLedgerId() {
  return getConfig('currentLedgerId', GAME_LEDGER_ID)
}

export async function setCurrentLedgerId(id) {
  return setConfig('currentLedgerId', id)
}

// ========== 初始化默认账本 + 迁移老游戏记录 ==========

export async function initDefaultLedgers() {
  const ledgers = await getLedgers()
  if (ledgers.length === 0) {
    for (const def of DEFAULT_LEDGERS) {
      if (def.id === GAME_LEDGER_ID) {
        const types = await getGameTypes()
        const plats = await getPlatforms()
        await addLedger(def.name, { ...def, categories: buildGameCategories(types, plats) })
      } else {
        await addLedger(def.name, def)
      }
    }
  }
  // 迁移：把旧 gameStore 里的记录转到 recordStore
  const migrated = await getConfig('legacy_game_migrated', false)
  if (!migrated) {
    await gameStore.iterate((r) => {
      const direction = (r.amount || 0) >= 0 ? 'income' : 'expense'
      recordStore.setItem(r.id, {
        id: r.id,
        ledgerId: GAME_LEDGER_ID,
        direction,
        category1: '',
        category1Name: r.type || '',
        category2: '',
        category2Name: r.platform || '',
        amount: Math.abs(r.amount || 0),
        note: r.note || '',
        platform: r.platform || '',
        legacyType: r.type || '',
        createdAt: r.createdAt || Date.now(),
      })
    })
    await setConfig('legacy_game_migrated', true)
  }
  // 迁移：把"游戏类型 + 平台"配置塞进游戏账本的分类树（如果分类为空）
  const gameMigrated = await getConfig('game_categories_migrated', false)
  if (!gameMigrated) {
    const stored = await configStore.getItem('cats_' + GAME_LEDGER_ID)
    const empty = !stored || ((stored.income?.length || 0) === 0 && (stored.expense?.length || 0) === 0)
    if (empty) {
      const types = await getGameTypes()
      const plats = await getPlatforms()
      await setCategories(GAME_LEDGER_ID, buildGameCategories(types, plats))
    }
    await setConfig('game_categories_migrated', true)
  }
  // 自愈：检测孤立分类（cats_X 没有对应 ledger）和孤立记录（record.ledgerId 找不到 ledger），重建丢失的 ledger 元数据
  await healOrphanLedgers()
}

async function healOrphanLedgers() {
  const knownIds = new Set()
  await ledgerStore.iterate((v) => { knownIds.add(v.id) })
  const referenced = new Set()
  await configStore.iterate((v, k) => {
    if (k && k.startsWith('cats_')) referenced.add(k.slice(5))
  })
  await recordStore.iterate((r) => {
    if (r.ledgerId) referenced.add(r.ledgerId)
  })
  let fixed = 0
  for (const lid of referenced) {
    if (knownIds.has(lid)) continue
    await ledgerStore.setItem(lid, {
      id: lid,
      name: lid === GAME_LEDGER_ID ? '游戏收支' : ('恢复账本_' + lid.slice(-6)),
      icon: 'balance-o',
      order: 99,
      builtIn: lid === GAME_LEDGER_ID,
      hasPlatform: lid === GAME_LEDGER_ID,
      createdAt: Date.now(),
      autoRecovered: true,
    })
    fixed++
  }
  if (fixed > 0) {
    console.warn(`[Heal] 检测到 ${fixed} 个孤立账本元数据，已自动重建。可在设置里改名。`)
  }
}

// ========== 扩展导出：含账本/分类/通用记录 ==========

const _origExportAllData = exportAllData

export async function exportAllDataV2() {
  const data = await _origExportAllData()
  data.ledgers = []
  data.records = []
  data.ledgerCategories = {}
  await ledgerStore.iterate((v) => data.ledgers.push(v))
  await recordStore.iterate((v) => data.records.push(v))
  for (const l of data.ledgers) {
    const c = await configStore.getItem('cats_' + l.id)
    if (c) data.ledgerCategories[l.id] = c
  }
  return data
}

export async function importAllDataV2(data) {
  await importAllData(data)
  const knownIds = new Set()
  const ledgerTasks = []
  if (Array.isArray(data.ledgers)) {
    for (const r of data.ledgers) {
      ledgerTasks.push(ledgerStore.setItem(r.id, r))
      knownIds.add(r.id)
    }
  }
  await Promise.all(ledgerTasks)
  // 收集被引用的 ledgerId
  const referencedIds = new Set()
  for (const r of (data.records || [])) if (r.ledgerId) referencedIds.add(r.ledgerId)
  for (const k of Object.keys(data.ledgerCategories || {})) referencedIds.add(k)
  for (const k of Object.keys(data.config || {})) {
    if (k.startsWith('cats_')) referencedIds.add(k.slice(5))
  }
  // 自动恢复孤立 ledger
  const recovered = []
  const recoverTasks = []
  for (const lid of referencedIds) {
    if (knownIds.has(lid)) continue
    const existing = await ledgerStore.getItem(lid)
    if (existing) continue
    recoverTasks.push(ledgerStore.setItem(lid, {
      id: lid,
      name: lid === GAME_LEDGER_ID ? '游戏收支' : ('恢复账本_' + lid.slice(-6)),
      icon: 'balance-o',
      order: 99,
      builtIn: lid === GAME_LEDGER_ID,
      hasPlatform: lid === GAME_LEDGER_ID,
      createdAt: Date.now(),
      autoRecovered: true,
    }))
    recovered.push(lid)
  }
  await Promise.all(recoverTasks)
  // 并行写入记录和分类
  const tasks = []
  if (Array.isArray(data.records)) for (const r of data.records) tasks.push(recordStore.setItem(r.id, r))
  if (data.ledgerCategories) {
    for (const [k, v] of Object.entries(data.ledgerCategories)) tasks.push(configStore.setItem('cats_' + k, v))
  }
  await Promise.all(tasks)
  return { recovered }
}

const _origClearAllData = clearAllData

export async function clearAllDataV2() {
  await _origClearAllData()
  await ledgerStore.clear()
  await recordStore.clear()
}
