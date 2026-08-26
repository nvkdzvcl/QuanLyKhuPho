import { test, expect } from '@playwright/test';

test.describe('Public Home Shell & Multi-Browser QA', () => {
  test.beforeEach(async ({ page }) => {
    // Deterministically mock unauthenticated boundary response for session check
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.',
          },
        }),
      });
    });

    // Deterministically mock health check endpoint
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          services: {
            database: { status: 'ok', message: 'PostgreSQL sẵn sàng' },
            redis: { status: 'ok', message: 'Redis sẵn sàng' },
            rabbitmq: { status: 'ok', message: 'RabbitMQ sẵn sàng' },
          },
        }),
      });
    });

    // Production landing requires an initialized, confirmed locality before
    // authentication controls are enabled.
    await page.route('**/api/deployment-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            initialized: true,
            profile: {
              schemaVersion: 1,
              slug: 'phuong-kiem-thu',
              localityCode: 'TEST-001',
              localityName: 'Phường Kiểm thử',
              localityLevel: 'ward',
              provinceCode: '79',
              provinceName: 'Thành phố Hồ Chí Minh',
              districtName: null,
              timezone: 'Asia/Ho_Chi_Minh',
              locale: 'vi-VN',
              brandName: 'Cổng thông tin Phường Kiểm thử',
              supportEmail: null,
              supportHotline: null,
              portalUrl: null,
              confirmed: true,
              confirmedAt: '2026-08-26T00:00:00.000Z',
              createdAt: '2026-08-26T00:00:00.000Z',
              updatedAt: '2026-08-26T00:00:00.000Z',
            },
          },
          timestamp: '2026-08-26T00:00:00.000Z',
        }),
      });
    });
  });

  test('public shell renders Vietnamese content within 3000ms budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');

    // Measure only navigation-to-usable-shell, before unrelated assertions.
    const heroHeading = page.getByRole('heading', {
      name: 'Kết nối cộng đồng, phục vụ người dân thuận tiện hơn',
      level: 1,
    });
    await expect(heroHeading).toBeVisible({ timeout: 3000 });
    const loadDuration = Date.now() - startTime;
    expect(loadDuration).toBeLessThanOrEqual(3000);

    // Verify Vietnamese language attribute on root document
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('vi');

    // Verify page title
    await expect(page).toHaveTitle(/Quản Lý Khu Phố/i);

    // Verify dynamic locality branding from the deployment profile.
    await expect(
      page.getByRole('link', {
        name: 'Cổng thông tin Phường Kiểm thử - về nội dung chính',
      }),
    ).toBeVisible();

    const loginButton = page.getByRole('button', {
      name: 'Đăng nhập / Đăng ký bằng OTP',
      exact: true,
    });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // Verify footer uses deployment branding and locality.
    await expect(
      page.getByText('© 2026 Cổng thông tin Phường Kiểm thử'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Cổng thông tin phục vụ cộng đồng dân cư Phường Kiểm thử, Thành phố Hồ Chí Minh',
      ),
    ).toBeVisible();
  });

  test('responsive layout fits viewport without horizontal overflow', async ({ page }, testInfo) => {
    await page.goto('/');

    // Wait for main content to load
    await expect(
      page.getByRole('heading', {
        name: 'Kết nối cộng đồng, phục vụ người dân thuận tiện hơn',
        level: 1,
      }),
    ).toBeVisible();

    // Assert exact viewport dimensions match project configuration
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(viewport).toEqual(testInfo.project.use.viewport);

    // Verify no unintended horizontal overflow beyond viewport width
    const overflowMetrics = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const windowWidth = window.innerWidth;
      const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
      return {
        windowWidth,
        scrollWidth,
        hasHorizontalOverflow: scrollWidth > windowWidth + 1,
      };
    });

    expect(
      overflowMetrics.hasHorizontalOverflow,
      `Horizontal overflow detected: scrollWidth (${overflowMetrics.scrollWidth}px) exceeds windowWidth (${overflowMetrics.windowWidth}px)`,
    ).toBe(false);
  });

  test('accessible login control opens and dismisses modal cleanly', async ({ page }) => {
    await page.goto('/');

    // Find and click the accessible login trigger button
    const loginButton = page.getByRole('button', {
      name: 'Đăng nhập / Đăng ký bằng OTP',
      exact: true,
    });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
    await loginButton.click();

    // Verify modal dialog appears with accessible role and attributes
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Đăng nhập hoặc Đăng ký' }),
    ).toBeVisible();

    // Verify accessible phone input and submit button
    const phoneInput = page.getByLabel('Số điện thoại');
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toBeEnabled();

    const submitOtpButton = page.getByRole('button', {
      name: 'Gửi mã xác thực OTP',
    });
    await expect(submitOtpButton).toBeVisible();

    // Test dismissing modal via accessible close button
    const closeButton = page.getByRole('button', { name: 'Đóng hộp thoại' });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(dialog).not.toBeVisible();

    // Reopen modal and test dismissing via Escape keyboard shortcut
    await loginButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
