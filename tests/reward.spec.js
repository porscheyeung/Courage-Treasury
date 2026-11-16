const { test, expect } = require('@playwright/test');
const R = require('../reward/reward-engine.js');
async function seed(page, items) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of kv) localStorage.setItem(k, v);
  }, items.map(([k, v]) => [k, JSON.stringify(v)]));
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), R.KEY);
async function setPin(page, pin = '2468') {
  await page.click('#parentBtn');
  await page.fill('[name=a]', pin); await page.fill('[name=b]', pin);
  await page.click('button:has-text("設定並進入")');
  await expect(page.locator('.p-head h2')).toHaveText('寶庫管理');
}
async function openChest(page) {
  await page.click('.draw-btn');
  for (let i = 0; i < 3; i++) await page.click('.fx-chest');
  await expect(page.locator('.fx.st-ready')).toBeVisible();
  await page.click('.fx-card');
  await expect(page.locator('.fx.st-result .fx-btns')).toBeVisible();
}

test('家長：密碼、加入碎片獎賞、送抽獎券、集齊碎片合成', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/?test');
  await expect(page.locator('.draw-btn')).toBeDisabled();
  await expect(page.locator('.castle-card')).toContainText('每一分努力都值得獎勵');
  await setPin(page);
  await page.click('[data-act=newReward]');
  await page.fill('.r-form [name=name]', '新畫冊');
  await page.fill('.r-form [name=note]', '集齊兩片換新畫冊');
  await page.click('.art-pick label:has-text("故事書")');
  await page.click('.seg.tiers label:has-text("傳說")');
  await page.click('.r-form .seg label:has-text("2 片")');
  await page.fill('.r-form [name=weight]', '100');
  await expect(page.locator('#rfPreview .rc-name')).toHaveText('新畫冊');
  await expect(page.locator('#rfOdds')).toContainText('抽中機率約');
  await page.click('.r-form button:has-text("儲存")');
  await expect(page.locator('.p-list')).toContainText('新畫冊');
  let s = await stored(page);
  expect(s.rewards.find((r) => r.name === '新畫冊')).toMatchObject({ pieces: 2, tier: 'legend', art: 'book', weight: 100 });
  for (const r of s.rewards.filter((x) => x.name !== '新畫冊')) {
    await page.click(`[data-act=editReward][data-id=${r.id}]`);
    await page.click('.r-form .switch');
    await page.click('.r-form button:has-text("儲存")');
  }
  await page.click('[data-act=pTab][data-p=tickets]');
  await page.fill('.tk-form [name=reason]', '在學校完成城堡');
  await page.click('[data-act=adj][data-n="1"]');
  await page.click('[data-act=adj][data-n="1"]');
  await expect(page.locator('#pTickets')).toHaveText('2');
  await page.click('.p-head [data-act=closeModal]');
  await page.evaluate(() => { let i = 0; const q = [0.2, 0.1, 0.0, 0.2, 0.1, 0.9]; window.__rw.setRng(() => q[i++ % q.length]); });
  await openChest(page);
  await expect(page.locator('.fb-tier')).toHaveText('傳說');
  await expect(page.locator('.fx-name')).toHaveText('新畫冊 碎片');
  await expect(page.locator('.fx-frag')).toContainText('得到碎片');
  await page.click('[data-act=fxAgain]');
  for (let i = 0; i < 3; i++) await page.click('.fx-chest');
  await page.click('.fx-card');
  await expect(page.locator('.fx-frag p')).toHaveText('碎片集齊，合成成功！');
  await expect(page.locator('.fb-tier')).toHaveText('合成成功');
  await page.click('[data-act=fxClose]');
  await page.click('.tabs [data-tab=bag]');
  await expect(page.locator('.bag-item')).toContainText('碎片合成');
  s = await stored(page);
  expect(s.tickets).toBe(0);
  expect(s.log.filter((e) => e.type === 'adjust').map((e) => e.reason)).toEqual(['在學校完成城堡', '在學校完成城堡']);
  await page.click('#parentBtn');
  await page.fill('[name=a]', '1111');
  await page.click('button:has-text("進入")');
  await expect(page.locator('#pinErr')).toHaveText('密碼不正確');
  expect(errors).toEqual([]);
});

