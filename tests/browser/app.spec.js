import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('hiển thị đủ 53 bài và không tràn ngang mobile', async ({ page }) => {
  await expect(page.locator('.deck-item')).toHaveCount(53);
  await expect(page.getByText('1.045 từ', { exact: false }).first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});

test('font stack hỗ trợ tiếng Việt và tách riêng chữ Nhật', async ({ page }) => {
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('#home-title')).fontFamily
  }));
  expect(fonts.body).toContain('Segoe UI');
  expect(fonts.body).toContain('Noto Sans');
  expect(fonts.heading).toContain('Cambria');
  expect(fonts.heading).toContain('Georgia');

  await page.locator('[data-start-deck="0"]').first().click();
  const japaneseFont = await page.locator('#card-front').evaluate((node) => getComputedStyle(node).fontFamily);
  expect(japaneseFont).toContain('Yu Mincho');
  expect(japaneseFont).toContain('Noto Serif JP');
});

test('đánh dấu được ngay ở mặt trước mà không cần lật thẻ', async ({ page }) => {
  await page.locator('[data-start-deck="0"]').first().click();
  await expect(page.locator('#flashcard')).not.toHaveClass(/is-flipped/);
  await expect(page.locator('#known-button')).toBeEnabled();
  await expect(page.locator('#again-button')).toBeEnabled();

  await page.locator('#known-button').click();
  await expect(page.locator('#card-front')).toHaveText('人間');
  await expect(page.locator('#study-count-label')).toHaveText('1 / 20 đã học');

  await expect(page.locator('#flashcard')).not.toHaveClass(/is-flipped/);
  await page.locator('#again-button').click();
  await expect(page.locator('#card-front')).toHaveText('人');
  await expect(page.locator('#study-count-label')).toHaveText('2 / 20 đã học');
});

test('thẻ và điều khiển vừa màn hình mobile nhỏ', async ({ page }) => {
  const viewports = [{ width: 320, height: 568 }, { width: 375, height: 667 }];
  for (let index = 0; index < viewports.length; index += 1) {
    const viewport = viewports[index];
    await page.setViewportSize(viewport);
    await page.locator('[data-start-deck="0"]').first().click();
    await expect(page.locator('#study-screen')).toBeVisible();
    const bounds = await page.locator('#known-button').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(viewport.width);
    await page.locator('#leave-study-button').click();
    await expect(page.locator('#home-screen')).toBeVisible();
  }
});

test('lật thẻ, trả lời và lưu tiến độ', async ({ page }) => {
  await page.locator('[data-start-deck="0"]').first().click();
  await expect(page.locator('#card-front')).toHaveText('人生');
  await page.locator('#flashcard').click();
  await expect(page.locator('#card-reading')).toHaveText('じんせい');
  await expect(page.locator('#known-button')).toBeEnabled();
  const knownFeedback = await page.evaluate(() => {
    document.querySelector('#known-button').click();
    return {
      card: document.querySelector('#flashcard').className,
      stamp: document.querySelector('#swipe-feedback-right').className
    };
  });
  expect(knownFeedback.card).toContain('is-answering-known');
  expect(knownFeedback.stamp).toContain('is-committed');
  await expect(page.locator('#card-front')).toHaveText('人間');
  await expect(page.locator('#study-count-label')).toHaveText('1 / 20 đã học');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('n2-flashcards:state:v1')));
  expect(saved.decks['0'].known).toEqual([1]);
});

test('chưa nhớ trong lượt đầu và hoàn tác phục hồi thẻ', async ({ page }) => {
  await page.locator('[data-start-deck="0"]').first().click();
  await page.locator('#flashcard').click();
  const againFeedback = await page.evaluate(() => {
    document.querySelector('#again-button').click();
    return {
      card: document.querySelector('#flashcard').className,
      stamp: document.querySelector('#swipe-feedback-left').className
    };
  });
  expect(againFeedback.card).toContain('is-answering-again');
  expect(againFeedback.stamp).toContain('is-committed');
  await expect(page.locator('#card-front')).toHaveText('人間');
  await page.locator('#undo-button').click();
  await expect(page.locator('#card-front')).toHaveText('人生');
});

test('điều hướng desktop bằng các phím mũi tên', async ({ page }) => {
  await page.locator('[data-start-deck="0"]').first().click();

  const usesFinePointer = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (usesFinePointer) {
    await expect(page.locator('.keyboard-hint').first()).toBeVisible();
    await expect(page.locator('.touch-hint').first()).toBeHidden();
  }

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#card-front')).toHaveText('人間');
  await expect(page.locator('#study-count-label')).toHaveText('1 / 20 đã học');

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#card-front')).toHaveText('人');
  await expect(page.locator('#study-count-label')).toHaveText('2 / 20 đã học');

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#flashcard')).toHaveClass(/is-flipped/);
  await expect(page.locator('#card-reading')).toHaveText('ひと');

  await page.keyboard.press('Backspace');
  await expect(page.locator('#card-front')).toHaveText('人間');
});

test('theme toggle được lưu', async ({ page }) => {
  const wasDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'));
  await page.locator('.theme-toggle').first().click();
  const isDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'));
  expect(isDark).toBe(!wasDark);
  const savedTheme = await page.evaluate(() => JSON.parse(localStorage.getItem('n2-flashcards:state:v1')).theme);
  expect(savedTheme).toBe(isDark ? 'dark' : 'light');
});

test('hoàn thành thẻ cuối mở màn hình tổng kết', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('n2-flashcards:state:v1', JSON.stringify({
      version: 1,
      theme: 'dark',
      lastDeckId: 0,
      decks: { 0: { known: Array.from({ length: 19 }, (_, index) => index + 1), misses: 2, updatedAt: Date.now() } }
    }));
  });
  await page.reload();
  await page.locator('[data-start-deck="0"]').first().click();
  await expect(page.locator('#card-front')).toHaveText('個性');
  await page.locator('#flashcard').click();
  await page.locator('#known-button').click();
  await expect(page.locator('#summary-screen')).toBeVisible();
  await expect(page.locator('#summary-title')).toHaveText('Bài 01 đã hoàn thành');
});

test('progress tăng theo từng thẻ rồi học tiếp từ chưa nhớ hoặc đặt lại', async ({ page }) => {
  await page.locator('[data-start-deck="52"]').first().click();
  await expect(page.locator('#study-count-label')).toHaveText('0 / 5 đã học');

  await page.locator('#again-button').click();
  await expect(page.locator('#card-front')).toHaveText('ある');
  await expect(page.locator('#study-count-label')).toHaveText('1 / 5 đã học');
  expect(await page.locator('#study-progress-bar').evaluate((node) => parseFloat(node.style.width))).toBe(20);

  for (let completed = 2; completed <= 4; completed += 1) {
    await page.locator('#known-button').click();
    await expect(page.locator('#study-count-label')).toHaveText(`${completed} / 5 đã học`);
  }
  await page.locator('#known-button').click();

  await expect(page.locator('#summary-screen')).toBeVisible();
  await expect(page.locator('#summary-known')).toHaveText('4');
  await expect(page.locator('#summary-remaining')).toHaveText('1');
  await expect(page.locator('#summary-message')).toContainText('5 từ của lượt này');
  await expect(page.locator('#review-button')).toHaveText('Học tiếp 1 từ chưa nhớ');
  await expect(page.locator('#summary-reset-button')).toBeVisible();

  await page.locator('#review-button').click();
  await expect(page.locator('#card-front')).toHaveText('本来');
  await expect(page.locator('#study-count-label')).toHaveText('0 / 1 đã học');

  await page.locator('#again-button').click();
  await expect(page.locator('#study-count-label')).toHaveText('1 / 1 đã học');
  await expect(page.locator('#summary-screen')).toBeVisible();
  await expect(page.locator('#summary-remaining')).toHaveText('1');
  await expect(page.locator('#summary-message')).toContainText('1 từ của lượt này');
  await expect(page.locator('#review-button')).toHaveText('Học tiếp 1 từ chưa nhớ');

  await page.locator('#review-button').click();
  await expect(page.locator('#card-front')).toHaveText('本来');
  await expect(page.locator('#study-count-label')).toHaveText('0 / 1 đã học');
  await page.locator('#known-button').click();

  await expect(page.locator('#summary-title')).toHaveText('Bài 53 đã hoàn thành');
  await expect(page.locator('#summary-known')).toHaveText('5');
  await expect(page.locator('#summary-remaining')).toHaveText('0');

  await page.locator('#summary-reset-button').click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-action').click();
  await expect(page.locator('#study-screen')).toBeVisible();
  await expect(page.locator('#card-front')).toHaveText('本来');
  await expect(page.locator('#study-count-label')).toHaveText('0 / 5 đã học');
});

test('manifest và service worker chuẩn bị đủ cache offline', async ({ page, request, context, browserName }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).short_name).toBe('N2 Goi');
  await page.evaluate(async () => Boolean(await navigator.serviceWorker.ready));
  await page.reload();
  const shellCached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((key) => key.startsWith('n2-goi-')));
    return Boolean(await cache.match(new URL('./index.html', location.href)));
  });
  expect(shellCached).toBe(true);

  // Playwright WebKit trên Windows gặp lỗi nội bộ khi reload cả trang trong chế
  // độ offline; Chromium vẫn kiểm tra đầy đủ đường tải lại offline thực tế.
  if (browserName === 'chromium') {
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator('#home-title')).toBeVisible();
      await expect(page.locator('.deck-item')).toHaveCount(53);
    } finally {
      await context.setOffline(false);
    }
  }
});
