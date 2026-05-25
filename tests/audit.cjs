/**
 * Full audit script — screenshots every module as all 3 roles.
 * Run: node tests/audit.cjs  (requires dev server at localhost:5173)
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = 'http://localhost:5173'
const OUT  = path.join(__dirname, 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const CREDS = {
  supervisor:  { username: 'supervisor1', password: 'Super@2026' },
  manager:     { username: 'manager',     password: 'Mgr@2026'   },
  herdsman:    { username: 'herdsman1',   password: 'Herd@2026'  },
}

async function ss(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('  ✓', name)
}

async function login(page, role) {
  await page.goto(`${BASE}/login`)
  await page.waitForSelector('input[placeholder="Enter your username"]')
  const { username, password } = CREDS[role]
  await page.fill('input[placeholder="Enter your username"]', username)
  await page.fill('input[placeholder="Enter your password"]', password)
  await page.click('button[type="submit"]')
  // Wait for navigation away from login
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 10000 })
    .catch(() => {}) // login might fail — screenshot will show error
  await page.waitForTimeout(500)
}

async function waitForContent(page, selector, timeout = 8000) {
  await page.waitForSelector(selector, { timeout }).catch(() => {})
}

async function auditSupervisor(browser) {
  console.log('\n=== SUPERVISOR ===')
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  await login(page, 'supervisor')
  await ss(page, '00_login_supervisor')

  // AM Dashboard — wait for group tally table
  await waitForContent(page, 'table', 6000)
  await page.waitForTimeout(1000)
  await ss(page, 'SUP_01_am_dashboard')

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  await ss(page, 'SUP_02_am_dashboard_scrolled')

  // PM Session — wait for Farm Tally table
  await page.goto(`${BASE}/pm`)
  await waitForContent(page, 'table thead', 8000)
  await page.waitForTimeout(1000)
  await ss(page, 'SUP_03_pm_session')

  // Live Map
  await page.goto(`${BASE}/map`)
  await waitForContent(page, 'h1', 3000)
  await page.waitForTimeout(2000)
  await ss(page, 'SUP_04_live_map')

  // History
  await page.goto(`${BASE}/history`)
  await waitForContent(page, 'h1', 3000)
  await page.waitForTimeout(500)
  await ss(page, 'SUP_05_history')

  // Settings — wait for staff list to load (Airtable round-trip)
  await page.goto(`${BASE}/settings`)
  await waitForContent(page, 'text=Deactivate', 8000)
  await page.waitForTimeout(500)
  await ss(page, 'SUP_06_settings_staff')

  try {
    await page.click('button:has-text("Groups")')
    await page.waitForTimeout(800)
    await ss(page, 'SUP_07_settings_groups')
  } catch(e) { console.log('  ✗ Settings Groups tab:', e.message) }

  try {
    await page.click('button:has-text("Animal Registry")')
    await page.waitForTimeout(800)
    await ss(page, 'SUP_08_settings_registry')
  } catch(e) { console.log('  ✗ Animal Registry tab:', e.message) }

  try {
    await page.click('button:has-text("Alert Config")')
    await page.waitForTimeout(500)
    await ss(page, 'SUP_09_settings_alerts')
  } catch(e) { console.log('  ✗ Alert Config tab:', e.message) }

  // Mobile view
  await ctx.close()
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mp   = await mctx.newPage()
  await login(mp, 'supervisor')
  await waitForContent(mp, '.md\\:hidden', 6000)
  await mp.waitForTimeout(1000)
  await ss(mp, 'SUP_10_mobile_am_dashboard')
  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await mp.waitForTimeout(600)
  await ss(mp, 'SUP_11_mobile_am_dashboard_scrolled')
  await mp.goto(`${BASE}/pm`)
  await waitForContent(mp, 'table', 8000)
  await mp.waitForTimeout(800)
  await ss(mp, 'SUP_12_mobile_pm_session')
  await mctx.close()
}

async function auditManager(browser) {
  console.log('\n=== FARM MANAGER ===')
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  await login(page, 'manager')
  // Wait for group cards to appear
  await waitForContent(page, '.rounded-2xl.border-2', 10000)
  await page.waitForTimeout(500)
  await ss(page, 'MGR_01_overview')

  await page.goto(`${BASE}/map`)
  await waitForContent(page, 'h1', 3000)
  await page.waitForTimeout(2000)
  await ss(page, 'MGR_02_live_map')

  await page.goto(`${BASE}/history`)
  await waitForContent(page, 'h1', 3000)
  await page.waitForTimeout(500)
  await ss(page, 'MGR_03_history')

  await page.goto(`${BASE}/settings`)
  await page.waitForTimeout(1500)
  await ss(page, 'MGR_04_settings_access')

  await ctx.close()
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mp   = await mctx.newPage()
  await login(mp, 'manager')
  await waitForContent(mp, '.rounded-2xl.border-2', 10000)
  await mp.waitForTimeout(500)
  await ss(mp, 'MGR_05_mobile_overview')
  await mctx.close()
}

async function auditHerdsman(browser) {
  console.log('\n=== HERDSMAN ===')
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  await login(page, 'herdsman')
  // Check if login succeeded or shows error
  const isOnLogin = page.url().includes('/login')
  if (isOnLogin) {
    await ss(page, 'HRD_00_login_failed')
    console.log('  ! Herdsman login failed — check credentials in Airtable')
  } else {
    await waitForContent(page, 'h1, .text-green-primary', 8000)
    await page.waitForTimeout(800)
    await ss(page, 'HRD_01_field_view_mobile')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)
    await ss(page, 'HRD_02_field_view_scrolled')
  }

  await page.goto(`${BASE}/dashboard`)
  await page.waitForTimeout(1000)
  await ss(page, 'HRD_03_unauthorized_redirect')

  await ctx.close()
}

;(async () => {
  console.log('Starting audit — screenshots → tests/screenshots/')
  const browser = await chromium.launch({ headless: true })
  try {
    await auditSupervisor(browser)
    await auditManager(browser)
    await auditHerdsman(browser)
    console.log('\nDone. All screenshots saved to tests/screenshots/')
  } finally {
    await browser.close()
  }
})()
