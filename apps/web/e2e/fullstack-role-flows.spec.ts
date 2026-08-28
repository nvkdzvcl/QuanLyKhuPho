import { test, expect, type Page } from '@playwright/test';
import { AnnouncementScope, PetitionCategory } from '@quanlykhupho/shared-types';

/**
 * Deterministic full-stack multi-role browser journey.
 * Exercises real Next.js UI, NestJS API, PostgreSQL (qlkp_e2e), and Redis (DB 15)
 * without mock routes, request interception, or direct database access.
 *
 * Journey flow:
 * 1. Officer authenticates via dev OTP and creates a Leader for KP-01.
 * 2. Resident completes OTP registration for KP-01 and sees pending status.
 * 3. Leader authenticates via dev OTP and approves the pending resident, then creates KP-01 announcement.
 * 4. Resident logs in via dev OTP, proves in-app notification fallback, comments on announcement, submits primary petition with real in-memory image evidence, and creates and cancels a second reviewing petition with confirmation and history evidence.
 * 5. Leader navigates to Petitions, exercises admin status/category/date filters, opens petition with evidence, advances to PROCESSING, and RESOLVES it with a note; then moderates comment, edits and removes announcement.
 * 6. Officer inspects ward-wide petition list, exercises status filters, verifies resolved petition, evidence & history; then creates a ward-wide announcement.
 * 7. Leader locks resident account, verifies blocked login, unlocks account, and resident logs in again, verifying durable petition status update and ward announcement in notification fallback and feed, followed by final petition status, note, and chronological timeline.
 */

const OFFICER = {
  phone: '0901234567',
  fullName: 'Cán bộ Kiểm thử E2E',
};

const LEADER = {
  phone: '0902345678',
  fullName: 'Trần Văn Trưởng Khu Phố',
  address: 'Trụ sở Ban điều hành KP-01',
  neighborhoodCode: 'KP-01',
};

const RESIDENT = {
  phone: '0903456789',
  fullName: 'Nguyễn Văn Cư Dân',
  address: 'Số 123 Đường Số 1, Khu phố 1',
};

const PETITION = {
  title: 'Kiến nghị sửa chữa nắp cống thoát nước đường số 1 E2E',
  description:
    'Nắp cống thoát nước trước số nhà 123 đường số 1 bị vỡ và sụt lún nghiêm trọng, gây nguy hiểm cho người đi đường và trẻ em. Kính đề nghị Ban quản lý khu phố cử đội kỹ thuật hỗ trợ khắc phục.',
  resolveNote:
    'Đội trật tự đô thị và kỹ thuật khu phố đã tiến hành thay mới nắp cống chịu lực vào sáng nay.',
};

const CANCELLED_PETITION = {
  title: 'Kiến nghị kiểm tra cành cây xanh che khuất biển báo E2E',
  description:
    'Cành cây xanh trước số nhà 125 đường số 1 che khuất biển báo giao thông ngã ba. Gia đình đã chủ động cắt tỉa an toàn nên xin hủy kiến nghị.',
  cancelReason: 'Hộ dân đã tự cắt tỉa cành cây an toàn',
};

// 1x1 valid PNG in-memory buffer for real file upload assertion
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const KP1_ANNOUNCEMENT = {
  title: 'Thông báo tổng vệ sinh môi trường Khu phố 1 E2E',
  content:
    'Ban điều hành Khu phố 1 phát động phong trào tổng vệ sinh môi trường, dọn dẹp cống rãnh vào sáng Chủ Nhật tuần này. Kính mời toàn thể nhân dân trong khu phố tham gia đầy đủ.',
  updatedTitle:
    'Thông báo tổng vệ sinh môi trường Khu phố 1 E2E (Đã cập nhật địa điểm tập trung)',
  updatedContent:
    'Ban điều hành Khu phố 1 cập nhật địa điểm tập trung ra quân tổng vệ sinh môi trường tại Nhà sinh hoạt cộng đồng Khu phố 1 lúc 7h30 sáng Chủ Nhật.',
};

const RESIDENT_COMMENT = {
  content:
    'Hộ gia đình số 123 đường số 1 đăng ký tham gia 2 người và hỗ trợ 1 xe đẩy thu gom rác.',
  moderateReason: 'Nội dung bình luận cần điều chỉnh phù hợp với mục đích thông báo',
};

const WARD_ANNOUNCEMENT = {
  title: 'Thông báo lịch tiêm chủng mở rộng và khám sức khỏe toàn phường E2E',
  content:
    'Ủy ban nhân dân phường thông báo kế hoạch tiêm chủng mở rộng và khám sức khỏe định kỳ cho người dân toàn phường diễn ra từ ngày 15 đến ngày 18 tháng này.',
};

/**
 * Test helper: Authenticates a registered user using the visible UI and dev SMS inbox autofill.
 */
async function loginWithDevOtp(page: Page, phone: string): Promise<void> {
  const openAuthBtn = page.getByRole('button', {
    name: 'Đăng nhập / Đăng ký bằng OTP',
    exact: true,
  });
  await expect(openAuthBtn).toBeVisible({ timeout: 10_000 });
  await openAuthBtn.click();

  const authDialog = page.getByRole('dialog');
  await expect(authDialog).toBeVisible();

  const phoneInput = page.getByLabel('Số điện thoại');
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill(phone);

  const sendOtpBtn = page.getByRole('button', {
    name: 'Gửi mã xác thực OTP',
    exact: true,
  });
  await expect(sendOtpBtn).toBeEnabled();
  await sendOtpBtn.click();

  // Wait for Dev SMS inbox autofill control for this phone number
  const autofillBtn = page.getByRole('button', {
    name: 'Tự động điền',
    exact: true,
  });
  const rateLimitMessage = page.getByText(
    /Bạn đã yêu cầu gửi mã quá nhiều lần.*thử lại sau \d+ giây/i,
  );
  const sendOutcome = await Promise.race([
    autofillBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'OTP' as const),
    rateLimitMessage
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'RATE_LIMIT' as const),
  ]);

  if (sendOutcome === 'RATE_LIMIT') {
    const message = await rateLimitMessage.textContent();
    const retryAfterSeconds = Number(message?.match(/(\d+)\s*giây/i)?.[1]);
    expect(retryAfterSeconds).toBeGreaterThan(0);
    // Honor the server-provided retry window instead of weakening the OTP
    // policy or using a fixed sleep that can race the Redis expiry.
    await page.waitForTimeout((retryAfterSeconds + 1) * 1_000);
    await expect(sendOtpBtn).toBeEnabled();
    await sendOtpBtn.click();
  }

  await expect(autofillBtn).toBeVisible({ timeout: 15_000 });
  await autofillBtn.click();

  const verifyOtpBtn = page.getByRole('button', {
    name: 'Xác nhận OTP',
    exact: true,
  });
  await expect(verifyOtpBtn).toBeEnabled();
  await verifyOtpBtn.click();
}

/**
 * Test helper: Logs out the current user via the visible role workspace UI.
 */
async function logoutUser(page: Page, fullName: string): Promise<void> {
  const accountTrigger = page.getByRole('button', {
    name: new RegExp(`Tài khoản ${fullName}`, 'i'),
  });
  await expect(accountTrigger).toBeVisible({ timeout: 10_000 });
  await accountTrigger.click();

  const logoutBtn = page.getByRole('menuitem', {
    name: /Đăng xuất/i,
  });
  await expect(logoutBtn).toBeVisible({ timeout: 10_000 });
  await logoutBtn.click();

  // Verify return to unauthenticated public landing page
  const openAuthBtn = page.getByRole('button', {
    name: 'Đăng nhập / Đăng ký bằng OTP',
    exact: true,
  });
  await expect(openAuthBtn).toBeVisible({ timeout: 10_000 });
  await expect(openAuthBtn).toBeEnabled();
}

test.describe('Full-Stack Multi-Role Journey (FS-E2E-ROLES)', () => {
  test('serial end-to-end journey across Officer, Resident, and Leader', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);

    // Initial navigation to public landing page
    await page.goto('/');
    await expect(
      page.getByRole('button', {
        name: 'Đăng nhập / Đăng ký bằng OTP',
        exact: true,
      }),
    ).toBeVisible();

    // =========================================================================
    // STEP 1: Officer login and creation of KP-01 leader
    // =========================================================================
    await test.step('1. Officer authenticates and creates a leader for KP-01', async () => {
      await loginWithDevOtp(page, OFFICER.phone);

      // Verify officer authenticated workspace
      await expect(page.getByText('Cán bộ địa phương').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(OFFICER.fullName).first()).toBeVisible();

      // Navigate to Leaders management section
      const leadersNavBtn = page.getByRole('button', {
        name: 'Quản lý Tổ trưởng',
        exact: true,
      });
      await expect(leadersNavBtn).toBeVisible();
      await leadersNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Quản lý Nhân sự Trưởng Khu Phố' }),
      ).toBeVisible();

      // Open leader appointment modal
      const createLeaderBtn = page.getByRole('button', {
        name: '+ Bổ nhiệm Trưởng khu phố',
      });
      await expect(createLeaderBtn).toBeVisible();
      await createLeaderBtn.click();

      const createLeaderDialog = page.getByRole('dialog');
      await expect(
        createLeaderDialog.getByRole('heading', { name: 'Bổ nhiệm Trưởng khu phố mới' }),
      ).toBeVisible();

      // Fill in new leader details
      await createLeaderDialog
        .getByLabel('Số điện thoại di động (10 số)')
        .fill(LEADER.phone);
      await createLeaderDialog
        .getByLabel('Họ và tên Trưởng khu phố')
        .fill(LEADER.fullName);
      await createLeaderDialog
        .getByLabel('Khu phố phụ trách')
        .selectOption({
          label: `Khu phố 1 (${LEADER.neighborhoodCode}) - Phường Thử Nghiệm`,
        });
      await createLeaderDialog
        .getByLabel('Địa chỉ nơi ở (tùy chọn)')
        .fill(LEADER.address);

      // Submit creation
      const submitLeaderBtn = createLeaderDialog.getByRole('button', {
        name: 'Tạo tài khoản Trưởng khu phố',
      });
      await expect(submitLeaderBtn).toBeEnabled();
      await submitLeaderBtn.click();

      // Assert visible creation success alert
      await expect(
        page.getByText(
          new RegExp(`Đã khởi tạo Trưởng khu phố "${LEADER.fullName}" thành công`, 'i'),
        ),
      ).toBeVisible({ timeout: 10_000 });

      // Logout Officer
      await logoutUser(page, OFFICER.fullName);
    });

    // =========================================================================
    // STEP 2: Resident OTP registration into KP-01
    // =========================================================================
    await test.step('2. Resident completes OTP registration for KP-01 and sees pending status', async () => {
      const openAuthBtn = page.getByRole('button', {
        name: 'Đăng nhập / Đăng ký bằng OTP',
        exact: true,
      });
      await expect(openAuthBtn).toBeVisible();
      await openAuthBtn.click();

      const authDialog = page.getByRole('dialog');
      await expect(authDialog).toBeVisible();

      // Enter unregistered resident phone
      const phoneInput = page.getByLabel('Số điện thoại');
      await phoneInput.fill(RESIDENT.phone);

      const sendOtpBtn = page.getByRole('button', {
        name: 'Gửi mã xác thực OTP',
        exact: true,
      });
      await sendOtpBtn.click();

      // Autofill OTP
      const autofillBtn = page.getByRole('button', {
        name: 'Tự động điền',
        exact: true,
      });
      await expect(autofillBtn).toBeVisible({ timeout: 15_000 });
      await autofillBtn.click();

      const verifyOtpBtn = page.getByRole('button', {
        name: 'Xác nhận OTP',
        exact: true,
      });
      await verifyOtpBtn.click();

      // Unregistered user transitions to registration step
      await expect(
        page.getByRole('heading', { name: 'Đăng ký thông tin Cư dân' }),
      ).toBeVisible({ timeout: 10_000 });

      // Fill in resident profile data
      await page.getByLabel('Họ và tên cư dân').fill(RESIDENT.fullName);
      await page
        .getByLabel('Địa chỉ nơi ở / Số nhà, Tên đường')
        .fill(RESIDENT.address);
      await page
        .getByLabel('Khu phố / Tổ dân phố trực thuộc')
        .selectOption({
          label: 'Khu phố 1 - Phường Thử Nghiệm, Quận Thử Nghiệm',
        });

      // Submit registration
      const submitRegBtn = page.getByRole('button', {
        name: 'Gửi yêu cầu đăng ký',
      });
      await expect(submitRegBtn).toBeEnabled();
      await submitRegBtn.click();

      // Assert pending approval confirmation modal
      await expect(
        page.getByRole('heading', { name: 'Hồ sơ đang chờ phê duyệt' }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Đang chờ xét duyệt')).toBeVisible();

      // Close status modal
      const dismissModalBtn = page.getByRole('button', {
        name: 'Đã hiểu & Đóng',
      });
      await expect(dismissModalBtn).toBeVisible();
      await dismissModalBtn.click();

      // Verify returned to unauthenticated landing page
      await expect(
        page.getByRole('button', {
          name: 'Đăng nhập / Đăng ký bằng OTP',
          exact: true,
        }),
      ).toBeVisible();
    });

    // =========================================================================
    // STEP 3: Leader login, resident approval, and KP-01 announcement creation
    // =========================================================================
    await test.step('3. Leader authenticates and approves pending resident', async () => {
      await loginWithDevOtp(page, LEADER.phone);

      // Verify leader workspace
      await expect(page.getByText('Trưởng khu phố').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(LEADER.fullName).first()).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Tổng quan Khu phố 1/i }),
      ).toBeVisible();

      // Leader sees named pending resident in work queue
      await expect(page.getByText(RESIDENT.fullName)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(RESIDENT.address)).toBeVisible();

      // Approve pending resident
      const approveBtn = page.getByRole('button', {
        name: 'Duyệt',
        exact: true,
      });
      await expect(approveBtn).toBeVisible();
      await approveBtn.click();

      // Assert approval confirmation toast
      await expect(
        page.getByText(
          new RegExp(`Đã phê duyệt tài khoản cư dân "${RESIDENT.fullName}" thành công`, 'i'),
        ),
      ).toBeVisible({ timeout: 10_000 });

      // Navigate to Leader Announcements section
      const announcementsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản lý' })
        .getByRole('button', {
          name: 'Thông báo',
          exact: true,
        });
      await expect(announcementsNavBtn).toBeVisible();
      await announcementsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Bảng Tin & Thông Báo Khu Phố' }),
      ).toBeVisible({ timeout: 10_000 });

      // Open announcement creation modal
      const createAnnouncementBtn = page.getByRole('button', {
        name: '+ Đăng thông báo mới',
        exact: true,
      });
      await expect(createAnnouncementBtn).toBeVisible();
      await createAnnouncementBtn.click();

      const createModal = page.getByRole('dialog');
      await expect(
        createModal.getByRole('heading', { name: 'Đăng Thông Báo Mới' }),
      ).toBeVisible();

      // Fill in neighborhood announcement details
      await createModal.getByLabel('Tiêu đề thông báo').fill(KP1_ANNOUNCEMENT.title);
      await createModal
        .getByPlaceholder('Nhập nội dung đầy đủ của thông báo...')
        .fill(KP1_ANNOUNCEMENT.content);

      // Submit creation
      const submitAnnouncementBtn = createModal.getByRole('button', {
        name: 'Đăng thông báo',
        exact: true,
      });
      await expect(submitAnnouncementBtn).toBeEnabled();
      await submitAnnouncementBtn.click();

      // Assert creation success toast and feed presence
      await expect(
        page.getByText('Đăng thông báo mới thành công!'),
      ).toBeVisible({ timeout: 10_000 });

      const kp1Heading = page.getByRole('heading', { name: KP1_ANNOUNCEMENT.title });
      await expect(kp1Heading).toBeVisible({ timeout: 10_000 });

      const kp1Card = page
        .locator('div')
        .filter({ has: kp1Heading })
        .first();
      await expect(kp1Card.getByText('Khu phố 1').first()).toBeVisible();
      await expect(kp1Card.getByText(KP1_ANNOUNCEMENT.content)).toBeVisible();

      // Logout Leader
      await logoutUser(page, LEADER.fullName);
    });

    // =========================================================================
    // STEP 4: Resident login, announcement notification fallback & comment, and petition creation
    // =========================================================================
    await test.step('4. Resident logs in and creates a petition', async () => {
      await loginWithDevOtp(page, RESIDENT.phone);

      // Verify resident workspace
      await expect(page.getByText(RESIDENT.fullName).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Cư dân · Khu phố 1/i).first()).toBeVisible();

      // Proves in-app notification fallback via notification bell
      const bellBtn = page.getByRole('button', {
        name: 'Thông báo trong ứng dụng',
        exact: true,
      });
      await expect(bellBtn).toBeVisible({ timeout: 10_000 });
      await bellBtn.click();

      // Find KP1 announcement notification in drawer
      const notifItem = page.getByText(
        new RegExp(`Thông báo mới \\[Khu phố\\]:\\s*${KP1_ANNOUNCEMENT.title}`, 'i'),
      ).first();
      await expect(notifItem).toBeVisible({ timeout: 10_000 });

      // Click notification item to open announcement detail modal
      await notifItem.click();

      const detailModal = page.getByRole('dialog');
      await expect(
        detailModal.getByRole('heading', { name: KP1_ANNOUNCEMENT.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(detailModal.getByText(KP1_ANNOUNCEMENT.content)).toBeVisible();

      // Submit resident comment
      const commentInput = detailModal.getByPlaceholder(
        'Viết ý kiến đóng góp / bình luận văn minh...',
      );
      await expect(commentInput).toBeVisible();
      await commentInput.fill(RESIDENT_COMMENT.content);

      const sendCommentBtn = detailModal.getByRole('button', {
        name: 'Gửi bình luận',
        exact: true,
      });
      await expect(sendCommentBtn).toBeEnabled();
      await sendCommentBtn.click();

      // Verify comment is persisted in detail view
      await expect(detailModal.getByText(RESIDENT_COMMENT.content)).toBeVisible({
        timeout: 10_000,
      });
      await expect(detailModal.getByText(RESIDENT.fullName).first()).toBeVisible();

      // Close announcement detail modal
      const closeDetailBtn = detailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
        exact: true,
      });
      await expect(closeDetailBtn).toBeVisible();
      await closeDetailBtn.click();

      // Open petition creation modal
      const createPetitionNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng Cư dân' })
        .getByRole('button', {
          name: 'Gửi kiến nghị',
          exact: true,
        });
      await expect(createPetitionNavBtn).toBeVisible();
      await createPetitionNavBtn.click();

      const createPetitionDialog = page.getByRole('dialog');
      await expect(
        createPetitionDialog.getByRole('heading', { name: 'Gửi Kiến nghị & Phản ánh Mới' }),
      ).toBeVisible();

      // Fill primary petition details with real in-memory image upload
      await createPetitionDialog
        .getByLabel('Tiêu đề kiến nghị / phản ánh')
        .fill(PETITION.title);
      await createPetitionDialog
        .getByLabel('Danh mục phản ánh')
        .selectOption(PetitionCategory.INFRASTRUCTURE);
      await createPetitionDialog
        .getByLabel(/Nội dung chi tiết kiến nghị/i)
        .fill(PETITION.description);

      // Attach in-memory PNG evidence through file input and verify client preview
      await createPetitionDialog
        .locator('input[type="file"]')
        .setInputFiles({
          name: 'evidence.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BUFFER,
        });
      await expect(
        createPetitionDialog.getByText('evidence.png'),
      ).toBeVisible();

      // Submit primary petition
      const submitPetitionBtn = createPetitionDialog.getByRole('button', {
        name: 'Gửi kiến nghị',
      });
      await expect(submitPetitionBtn).toBeEnabled();
      await submitPetitionBtn.click();

      // Assert success alert and presence with evidence representation in resident petition list
      await expect(
        page.getByText('Đã gửi kiến nghị mới thành công!'),
      ).toBeVisible({ timeout: 10_000 });
      const primaryPetitionCard = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: PETITION.title }) })
        .first();
      await expect(primaryPetitionCard).toBeVisible({ timeout: 10_000 });
      await expect(primaryPetitionCard.getByText('Chờ tiếp nhận').first()).toBeVisible();
      await expect(primaryPetitionCard.getByText('1 ảnh')).toBeVisible();

      // Create a second petition to exercise reviewing-state resident cancellation
      const createSecondBtn = page.getByRole('button', {
        name: '+ Gửi kiến nghị mới',
      });
      await expect(createSecondBtn).toBeVisible();
      await createSecondBtn.click();

      await expect(
        createPetitionDialog.getByRole('heading', { name: 'Gửi Kiến nghị & Phản ánh Mới' }),
      ).toBeVisible();
      await createPetitionDialog
        .getByLabel('Tiêu đề kiến nghị / phản ánh')
        .fill(CANCELLED_PETITION.title);
      await createPetitionDialog
        .getByLabel('Danh mục phản ánh')
        .selectOption(PetitionCategory.SANITATION);
      await createPetitionDialog
        .getByLabel(/Nội dung chi tiết kiến nghị/i)
        .fill(CANCELLED_PETITION.description);

      const submitSecondBtn = createPetitionDialog.getByRole('button', {
        name: 'Gửi kiến nghị',
      });
      await expect(submitSecondBtn).toBeEnabled();
      await submitSecondBtn.click();

      await expect(
        page.getByText('Đã gửi kiến nghị mới thành công!'),
      ).toBeVisible({ timeout: 10_000 });

      // Open second petition detail and cancel through the UI
      const secondHeading = page.getByRole('heading', {
        name: CANCELLED_PETITION.title,
      });
      await expect(secondHeading).toBeVisible({ timeout: 10_000 });
      await secondHeading.click();

      const secondDetailModal = page.getByRole('dialog');
      await expect(
        secondDetailModal.getByRole('heading', {
          name: 'Chi tiết Kiến nghị & Phản ánh',
        }),
      ).toBeVisible();
      await expect(secondDetailModal.getByText(CANCELLED_PETITION.title)).toBeVisible();
      await expect(secondDetailModal.getByText('Chờ tiếp nhận').first()).toBeVisible();

      // Initiate cancellation
      const cancelPetitionBtn = secondDetailModal.getByRole('button', {
        name: 'Hủy kiến nghị này',
      });
      await expect(cancelPetitionBtn).toBeVisible();
      await cancelPetitionBtn.click();

      // Fill cancellation confirmation dialog
      const cancelConfirmDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Xác nhận hủy kiến nghị' }),
      });
      await expect(cancelConfirmDialog).toBeVisible({ timeout: 10_000 });
      await cancelConfirmDialog
        .getByLabel(/Lý do hủy/i)
        .fill(CANCELLED_PETITION.cancelReason);

      const confirmCancelBtn = cancelConfirmDialog.getByRole('button', {
        name: 'Xác nhận hủy kiến nghị',
      });
      await expect(confirmCancelBtn).toBeEnabled();
      await confirmCancelBtn.click();

      await expect(
        page.getByText('Đã hủy kiến nghị thành công.'),
      ).toBeVisible({ timeout: 10_000 });

      // Assert cancelled state and history evidence in detail modal
      await expect(
        secondDetailModal.getByText('Đã hủy').first(),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        secondDetailModal.getByText(CANCELLED_PETITION.cancelReason),
      ).toBeVisible();

      const closeSecondModalBtn = secondDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
      });
      await expect(closeSecondModalBtn).toBeVisible();
      await closeSecondModalBtn.click();

      // Assert cancelled badge reflected on list card
      const secondCard = page
        .locator('div')
        .filter({ has: secondHeading })
        .first();
      await expect(secondCard.getByText('Đã hủy').first()).toBeVisible();

      // Logout Resident
      await logoutUser(page, RESIDENT.fullName);
    });

    // =========================================================================
    // STEP 5: Leader handles and resolves the petition, moderates comment, edits & removes announcement
    // =========================================================================
    await test.step('5. Leader reviews and resolves the petition', async () => {
      await loginWithDevOtp(page, LEADER.phone);

      // Navigate to Leader Petitions section
      const petitionsNavBtn = page.getByRole('button', {
        name: 'Kiến nghị',
        exact: true,
      });
      await expect(petitionsNavBtn).toBeVisible();
      await petitionsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Quản lý Kiến nghị Phản ánh Khu phố' }),
      ).toBeVisible();

      // Exercise admin status filters
      const reviewingFilterBtn = page.getByRole('button', {
        name: 'Chờ tiếp nhận',
        exact: true,
      });
      await reviewingFilterBtn.click();
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).not.toBeVisible();

      const cancelledFilterBtn = page.getByRole('button', {
        name: 'Đã hủy',
        exact: true,
      });
      await cancelledFilterBtn.click();
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).not.toBeVisible();

      const allStatusFilterBtn = page.getByRole('button', {
        name: 'Tất cả',
        exact: true,
      });
      await allStatusFilterBtn.click();
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).toBeVisible();

      // Exercise admin category filter
      const categoryFilterSelect = page.getByLabel('Lọc theo danh mục');
      await categoryFilterSelect.selectOption(PetitionCategory.SANITATION);
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).not.toBeVisible();

      await categoryFilterSelect.selectOption(PetitionCategory.INFRASTRUCTURE);
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).not.toBeVisible();

      await categoryFilterSelect.selectOption('');
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: CANCELLED_PETITION.title }),
      ).toBeVisible();

      // Exercise admin date filter and clear
      const todayStr = new Date().toISOString().slice(0, 10);
      await page.getByLabel('Từ ngày').fill(todayStr);
      await page.getByLabel('Đến ngày').fill(todayStr);
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await page.getByLabel('Từ ngày').fill('');
      await page.getByLabel('Đến ngày').fill('');

      // Locate and click on the resident's petition
      const petitionCard = page.getByRole('heading', { name: PETITION.title });
      await expect(petitionCard).toBeVisible({ timeout: 10_000 });
      await petitionCard.click();

      // Verify detail modal and evidence representation
      const petitionDetailModal = page.getByRole('dialog');
      await expect(
        petitionDetailModal.getByRole('heading', { name: 'Chi tiết Kiến nghị & Phản ánh' }),
      ).toBeVisible();
      await expect(petitionDetailModal.getByText(PETITION.title)).toBeVisible();
      await expect(
        petitionDetailModal.getByText(new RegExp(`Người gửi:\\s*${RESIDENT.fullName}`, 'i')),
      ).toBeVisible();
      await expect(
        petitionDetailModal.getByRole('heading', { name: /Hình ảnh minh chứng/i }),
      ).toBeVisible();
      await expect(petitionDetailModal.getByText('evidence.png')).toBeVisible();

      // Advance status to PROCESSING
      const startProcessingBtn = petitionDetailModal.getByRole('button', {
        name: /Tiếp nhận xử lý/i,
      });
      await expect(startProcessingBtn).toBeVisible();
      await startProcessingBtn.click();

      await expect(
        page.getByText('Đã chuyển trạng thái kiến nghị sang "Đang xử lý".'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(petitionDetailModal.getByText('Đang xử lý').first()).toBeVisible();

      // Resolve the petition
      const resolveBtn = petitionDetailModal.getByRole('button', {
        name: /Giải quyết thành công/i,
      });
      await expect(resolveBtn).toBeVisible();
      await resolveBtn.click();

      // Enter resolve note in confirmation sub-modal
      await expect(
        page.getByRole('heading', { name: 'Xác nhận giải quyết kiến nghị' }),
      ).toBeVisible();
      await page
        .getByLabel(/Kết quả \/ Hướng dẫn giải quyết/i)
        .fill(PETITION.resolveNote);

      const confirmResolveBtn = page.getByRole('button', {
        name: 'Xác nhận hoàn thành',
      });
      await expect(confirmResolveBtn).toBeEnabled();
      await confirmResolveBtn.click();

      await expect(
        page.getByText('Đã đánh dấu kiến nghị là "Đã giải quyết".'),
      ).toBeVisible({ timeout: 10_000 });

      // Verify resolved note appears in history timeline
      await expect(petitionDetailModal.getByText(PETITION.resolveNote)).toBeVisible();

      // Close petition detail modal
      const closePetitionModalBtn = petitionDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
      });
      await expect(closePetitionModalBtn).toBeVisible();
      await closePetitionModalBtn.click();

      // Navigate to Leader Announcements section
      const announcementsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản lý' })
        .getByRole('button', {
          name: 'Thông báo',
          exact: true,
        });
      await expect(announcementsNavBtn).toBeVisible();
      await announcementsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Bảng Tin & Thông Báo Khu Phố' }),
      ).toBeVisible({ timeout: 10_000 });

      // Locate KP-01 announcement card and open detail modal to inspect/moderate comment
      const announcementHeading = page.getByRole('heading', {
        name: KP1_ANNOUNCEMENT.title,
      });
      await expect(announcementHeading).toBeVisible({ timeout: 10_000 });
      const announcementCard = page
        .locator('div')
        .filter({ has: announcementHeading })
        .first();

      const viewDetailBtn = announcementCard.getByRole('button', {
        name: 'Xem chi tiết & Ý kiến →',
        exact: true,
      });
      await expect(viewDetailBtn).toBeVisible();
      await viewDetailBtn.click();

      const announcementDetailModal = page.getByRole('dialog');
      await expect(
        announcementDetailModal.getByRole('heading', { name: KP1_ANNOUNCEMENT.title }),
      ).toBeVisible({ timeout: 10_000 });

      // Leader sees resident's comment and initiates moderation
      await expect(
        announcementDetailModal.getByText(RESIDENT_COMMENT.content),
      ).toBeVisible({ timeout: 10_000 });

      const moderateCommentBtn = announcementDetailModal.getByRole('button', {
        name: 'Kiểm duyệt',
        exact: true,
      });
      await expect(moderateCommentBtn).toBeVisible();
      await moderateCommentBtn.click();

      // Moderation confirmation modal
      const moderateDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Ẩn bình luận vi phạm' }),
      });
      await expect(moderateDialog).toBeVisible({ timeout: 10_000 });

      const moderateReasonInput = moderateDialog.getByPlaceholder(
        'Ví dụ: Ngôn từ không phù hợp, spam...',
      );
      await moderateReasonInput.fill(RESIDENT_COMMENT.moderateReason);

      const confirmModerateBtn = moderateDialog.getByRole('button', {
        name: 'Xác nhận ẩn',
        exact: true,
      });
      await expect(confirmModerateBtn).toBeEnabled();
      await confirmModerateBtn.click();

      // Assert moderated comment displays hidden state and reason in detail modal
      await expect(
        announcementDetailModal.getByText('Đã bị ẩn'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        announcementDetailModal.getByText(
          new RegExp(`Lý do ẩn:\\s*${RESIDENT_COMMENT.moderateReason}`, 'i'),
        ),
      ).toBeVisible();

      // Close announcement detail modal
      const closeDetailBtn = announcementDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
        exact: true,
      });
      await expect(closeDetailBtn).toBeVisible();
      await closeDetailBtn.click();

      // Edit the announcement
      const editBtn = announcementCard.getByRole('button', {
        name: 'Sửa',
        exact: true,
      });
      await expect(editBtn).toBeVisible();
      await editBtn.click();

      const editDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Chỉnh sửa thông báo' }),
      });
      await expect(editDialog).toBeVisible({ timeout: 10_000 });

      const editTitleInput = editDialog.getByLabel('Tiêu đề thông báo');
      await editTitleInput.fill(KP1_ANNOUNCEMENT.updatedTitle);

      const editContentInput = editDialog.locator('textarea');
      await editContentInput.fill(KP1_ANNOUNCEMENT.updatedContent);

      const saveChangesBtn = editDialog.getByRole('button', {
        name: 'Lưu thay đổi',
        exact: true,
      });
      await expect(saveChangesBtn).toBeEnabled();
      await saveChangesBtn.click();

      // Assert edit success toast and updated title in feed
      await expect(
        page.getByText('Cập nhật thông báo thành công!'),
      ).toBeVisible({ timeout: 10_000 });

      const updatedHeading = page.getByRole('heading', {
        name: KP1_ANNOUNCEMENT.updatedTitle,
      });
      await expect(updatedHeading).toBeVisible({ timeout: 10_000 });

      // Remove the announcement through visible UI
      const updatedCard = page
        .locator('div')
        .filter({ has: updatedHeading })
        .first();

      const removeBtn = updatedCard.getByRole('button', {
        name: 'Gỡ bỏ',
        exact: true,
      });
      await expect(removeBtn).toBeVisible();
      await removeBtn.click();

      const removeDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Gỡ bỏ thông báo khỏi bảng tin' }),
      });
      await expect(removeDialog).toBeVisible({ timeout: 10_000 });

      const confirmRemoveBtn = removeDialog.getByRole('button', {
        name: 'Xác nhận gỡ thông báo',
        exact: true,
      });
      await expect(confirmRemoveBtn).toBeEnabled();
      await confirmRemoveBtn.click();

      // Assert removal toast and absence from public feed
      await expect(
        page.getByText('Đã gỡ thông báo khỏi bảng tin công khai.'),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByRole('heading', { name: KP1_ANNOUNCEMENT.updatedTitle }),
      ).not.toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: KP1_ANNOUNCEMENT.title }),
      ).not.toBeVisible();

      // Logout Leader
      await logoutUser(page, LEADER.fullName);
    });

    // =========================================================================
    // STEP 6: Officer verifies ward petitions and creates ward-wide announcement
    // =========================================================================
    await test.step('6. Officer verifies the resolved petition in ward scope', async () => {
      await loginWithDevOtp(page, OFFICER.phone);

      // Navigate to Officer Petitions section
      const petitionsNavBtn = page.getByRole('button', {
        name: 'Kiến nghị',
        exact: true,
      });
      await expect(petitionsNavBtn).toBeVisible();
      await petitionsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Quản lý & Giám sát Kiến nghị Toàn phường' }),
      ).toBeVisible();

      // Assert petition is visible in ward scope with evidence count
      const wardPetition = page.getByRole('heading', { name: PETITION.title });
      await expect(wardPetition).toBeVisible({ timeout: 10_000 });
      const wardPetitionCard = page.getByRole('button').filter({ has: wardPetition });
      await expect(wardPetitionCard.getByText(/Khu phố 1/)).toBeVisible();
      await expect(
        wardPetitionCard.getByText(RESIDENT.fullName, { exact: true }),
      ).toBeVisible();
      await expect(wardPetitionCard.getByText('1 ảnh')).toBeVisible();

      // Exercise officer status filtering
      const resolvedFilterBtn = page.getByRole('button', {
        name: 'Đã giải quyết',
        exact: true,
      });
      await resolvedFilterBtn.click();
      await expect(wardPetition).toBeVisible({ timeout: 10_000 });

      const allFilterBtn = page.getByRole('button', {
        name: 'Tất cả',
        exact: true,
      });
      await allFilterBtn.click();
      await expect(wardPetition).toBeVisible();

      // Open detail modal in officer view
      await wardPetitionCard.click();

      const officerDetailModal = page.getByRole('dialog');
      await expect(
        officerDetailModal.getByRole('heading', { name: 'Chi tiết Kiến nghị & Phản ánh' }),
      ).toBeVisible();
      await expect(officerDetailModal.getByText(PETITION.title)).toBeVisible();
      await expect(
        officerDetailModal.getByText(
          new RegExp(`Người gửi:\\s*${RESIDENT.fullName}`, 'i'),
        ),
      ).toBeVisible();
      await expect(officerDetailModal.getByText(PETITION.resolveNote)).toBeVisible();
      await expect(
        officerDetailModal.getByRole('heading', { name: /Hình ảnh minh chứng/i }),
      ).toBeVisible();
      await expect(officerDetailModal.getByText('evidence.png')).toBeVisible();

      // Close detail modal
      const closeModalBtn = officerDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
      });
      await expect(closeModalBtn).toBeVisible();
      await closeModalBtn.click();

      // Navigate to Officer Announcements section
      const announcementsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản trị địa bàn' })
        .getByRole('button', {
          name: 'Thông báo',
          exact: true,
        });
      await expect(announcementsNavBtn).toBeVisible();
      await announcementsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Bảng Tin & Thông Báo Khu Phố' }),
      ).toBeVisible({ timeout: 10_000 });

      // Open announcement creation modal
      const createAnnouncementBtn = page.getByRole('button', {
        name: '+ Đăng thông báo mới',
        exact: true,
      });
      await expect(createAnnouncementBtn).toBeVisible();
      await createAnnouncementBtn.click();

      const createModal = page.getByRole('dialog');
      await expect(
        createModal.getByRole('heading', { name: 'Đăng Thông Báo Mới' }),
      ).toBeVisible();

      // Select Ward-wide scope
      const scopeSelect = createModal.getByLabel('Phạm vi phát thông báo');
      await scopeSelect.selectOption(AnnouncementScope.WARD);

      // Fill in ward announcement details
      await createModal.getByLabel('Tiêu đề thông báo').fill(WARD_ANNOUNCEMENT.title);
      await createModal
        .getByPlaceholder('Nhập nội dung đầy đủ của thông báo...')
        .fill(WARD_ANNOUNCEMENT.content);

      // Submit creation
      const submitAnnouncementBtn = createModal.getByRole('button', {
        name: 'Đăng thông báo',
        exact: true,
      });
      await expect(submitAnnouncementBtn).toBeEnabled();
      await submitAnnouncementBtn.click();

      // Assert creation success toast and feed entry
      await expect(
        page.getByText('Đăng thông báo mới thành công!'),
      ).toBeVisible({ timeout: 10_000 });

      const wardAnnouncementHeading = page.getByRole('heading', {
        name: WARD_ANNOUNCEMENT.title,
      });
      await expect(wardAnnouncementHeading).toBeVisible({ timeout: 10_000 });

      const wardCard = page
        .locator('div')
        .filter({ has: wardAnnouncementHeading })
        .first();
      await expect(wardCard.getByText('Toàn phường').first()).toBeVisible();
      await expect(wardCard.getByText(WARD_ANNOUNCEMENT.content)).toBeVisible();

      // Final logout
      await logoutUser(page, OFFICER.fullName);
    });

    // =========================================================================
    // STEP 7: Leader locks resident account, blocks login, unlocks, and resident logs in verifying ward announcement
    // =========================================================================
    await test.step('7. Leader locks resident, verifies blocked login, unlocks account, and resident logs in again', async () => {
      // 1. Leader authenticates and navigates to Account Moderation
      await loginWithDevOtp(page, LEADER.phone);
      await expect(page.getByText('Trưởng khu phố').first()).toBeVisible({ timeout: 10_000 });

      const moderationNavBtn = page.getByRole('button', {
        name: 'Tài khoản cư dân',
        exact: true,
      });
      await expect(moderationNavBtn).toBeVisible();
      await moderationNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Danh sách Cư dân trong Khu phố' }),
      ).toBeVisible({ timeout: 10_000 });

      // 2. Locate active resident and perform lock action with mandatory reason
      const residentHeading = page.getByRole('heading', {
        name: RESIDENT.fullName,
      });
      await expect(residentHeading).toBeVisible({ timeout: 10_000 });

      const activeResidentCard = page
        .locator('div')
        .filter({ has: residentHeading })
        .filter({ has: page.getByText('Đang hoạt động') })
        .first();
      await expect(activeResidentCard).toBeVisible();

      const lockBtn = activeResidentCard.getByRole('button', {
        name: 'Khóa tài khoản',
        exact: true,
      });
      await expect(lockBtn).toBeVisible();
      await lockBtn.click();

      const lockDialog = page.getByRole('dialog');
      await expect(
        lockDialog.getByRole('heading', { name: 'Khóa tài khoản cư dân' }),
      ).toBeVisible();

      const lockReasonInput = lockDialog.getByLabel(
        /Lý do khóa tài khoản \(bắt buộc\)/i,
      );
      await lockReasonInput.fill('Tạm khóa để xác minh cập nhật thông tin cư trú E2E');

      const confirmLockBtn = lockDialog.getByRole('button', {
        name: 'Xác nhận khóa tài khoản',
        exact: true,
      });
      await expect(confirmLockBtn).toBeEnabled();
      await confirmLockBtn.click();

      await expect(
        page.getByText(
          new RegExp(`Đã khóa tài khoản "${RESIDENT.fullName}"`, 'i'),
        ),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByText('Tạm khóa để xác minh cập nhật thông tin cư trú E2E'),
      ).toBeVisible();

      // 3. A separate resident browser session is blocked while the leader
      // remains authenticated and can continue the moderation workflow.
      const lockedResidentContext = await browser.newContext();
      const lockedResidentPage = await lockedResidentContext.newPage();
      try {
        await lockedResidentPage.goto(new URL('/', page.url()).toString());
        await loginWithDevOtp(lockedResidentPage, RESIDENT.phone);

        await expect(
          lockedResidentPage.getByRole('heading', {
            name: 'Tài khoản đã bị tạm khóa',
          }),
        ).toBeVisible({ timeout: 10_000 });
        await expect(lockedResidentPage.getByText('Đã bị khóa')).toBeVisible();

        const dismissModalBtn = lockedResidentPage.getByRole('button', {
          name: 'Đã hiểu & Đóng',
          exact: true,
        });
        await expect(dismissModalBtn).toBeVisible();
        await dismissModalBtn.click();

        await expect(
          lockedResidentPage.getByRole('button', {
            name: 'Đăng nhập / Đăng ký bằng OTP',
            exact: true,
          }),
        ).toBeVisible();
      } finally {
        await lockedResidentContext.close();
      }

      // 4. The still-authenticated leader unlocks the resident account.

      const lockedResidentCard = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: RESIDENT.fullName }) })
        .filter({ has: page.getByText('Đã khóa') })
        .first();
      await expect(lockedResidentCard).toBeVisible({ timeout: 10_000 });

      const unlockBtn = lockedResidentCard.getByRole('button', {
        name: 'Mở khóa',
        exact: true,
      });
      await expect(unlockBtn).toBeVisible();
      await unlockBtn.click();

      const unlockDialog = page.getByRole('dialog');
      await expect(
        unlockDialog.getByRole('heading', { name: 'Mở khóa tài khoản cư dân' }),
      ).toBeVisible();

      const confirmUnlockBtn = unlockDialog.getByRole('button', {
        name: 'Xác nhận mở khóa',
        exact: true,
      });
      await expect(confirmUnlockBtn).toBeEnabled();
      await confirmUnlockBtn.click();

      await expect(
        page.getByText(
          new RegExp(`Đã mở khóa tài khoản cư dân "${RESIDENT.fullName}" thành công`, 'i'),
        ),
      ).toBeVisible({ timeout: 10_000 });

      await logoutUser(page, LEADER.fullName);

      // 5. Resident logs in successfully again
      await loginWithDevOtp(page, RESIDENT.phone);
      await expect(page.getByText(RESIDENT.fullName).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Cư dân · Khu phố 1/i).first()).toBeVisible();

      // Proves ward-wide announcement and petition status notifications appear in in-app notification fallback
      const bellBtn = page.getByRole('button', {
        name: 'Thông báo trong ứng dụng',
        exact: true,
      });
      await expect(bellBtn).toBeVisible({ timeout: 10_000 });
      await bellBtn.click();

      // Verify durable in-app petition status notification in bell drawer
      const petitionResolvedNotif = page.getByText(
        /Cập nhật trạng thái kiến nghị:\s*Đã giải quyết/i,
      ).first();
      await expect(petitionResolvedNotif).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText(
          new RegExp(
            `Kiến nghị "${PETITION.title}" của bạn đã chuyển sang trạng thái "Đã giải quyết"`,
            'i',
          ),
        ).first(),
      ).toBeVisible();

      const wardNotifItem = page.getByText(
        new RegExp(`Thông báo mới \\[Toàn phường\\]:\\s*${WARD_ANNOUNCEMENT.title}`, 'i'),
      ).first();
      await expect(wardNotifItem).toBeVisible({ timeout: 10_000 });

      // Click notification item to view detail and confirm scope
      await wardNotifItem.click();

      const wardDetailModal = page.getByRole('dialog');
      await expect(
        wardDetailModal.getByRole('heading', { name: WARD_ANNOUNCEMENT.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(wardDetailModal.getByText(WARD_ANNOUNCEMENT.content)).toBeVisible();
      await expect(wardDetailModal.getByText('Toàn phường').first()).toBeVisible();

      const closeWardDetailBtn = wardDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
        exact: true,
      });
      await expect(closeWardDetailBtn).toBeVisible();
      await closeWardDetailBtn.click();

      // Navigate to Resident Announcements section to prove presence in announcement feed
      const residentAnnouncementsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng Cư dân' })
        .getByRole('button', {
          name: /^Thông báo(?:\s+\d+)?$/,
        });
      await expect(residentAnnouncementsNavBtn).toBeVisible();
      await residentAnnouncementsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Bảng Tin & Thông Báo Khu Phố' }),
      ).toBeVisible({ timeout: 10_000 });

      const residentWardHeading = page.getByRole('heading', {
        name: WARD_ANNOUNCEMENT.title,
      });
      await expect(residentWardHeading).toBeVisible({ timeout: 10_000 });

      const residentWardCard = page
        .locator('div')
        .filter({ has: residentWardHeading })
        .first();
      await expect(residentWardCard.getByText('Toàn phường').first()).toBeVisible();
      await expect(residentWardCard.getByText(WARD_ANNOUNCEMENT.content)).toBeVisible();

      // Navigate to Resident Petitions section to prove final status, response, and chronological timeline
      const residentPetitionsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng Cư dân' })
        .getByRole('button', {
          name: 'Kiến nghị của tôi',
          exact: true,
        });
      await expect(residentPetitionsNavBtn).toBeVisible({ timeout: 10_000 });
      await residentPetitionsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Kiến nghị của tôi', level: 3 }),
      ).toBeVisible({ timeout: 10_000 });

      const residentPetitionHeading = page.getByRole('heading', {
        name: PETITION.title,
      });
      await expect(residentPetitionHeading).toBeVisible({ timeout: 10_000 });

      const residentPetitionCard = page
        .locator('div')
        .filter({ has: residentPetitionHeading })
        .first();
      await expect(residentPetitionCard.getByText('Đã giải quyết').first()).toBeVisible();
      await expect(residentPetitionCard.getByText('1 ảnh')).toBeVisible();
      await expect(
        residentPetitionCard.getByText(
          new RegExp(`Ghi chú:.*${PETITION.resolveNote}`, 'i'),
        ),
      ).toBeVisible();

      // Open detail modal in resident view
      await residentPetitionHeading.click();

      const residentDetailModal = page.getByRole('dialog');
      await expect(
        residentDetailModal.getByRole('heading', {
          name: 'Chi tiết Kiến nghị & Phản ánh',
        }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(residentDetailModal.getByText(PETITION.title)).toBeVisible();
      await expect(residentDetailModal.getByText('Đã giải quyết').first()).toBeVisible();
      await expect(
        residentDetailModal.getByRole('heading', { name: /Hình ảnh minh chứng/i }),
      ).toBeVisible();
      await expect(residentDetailModal.getByText('evidence.png')).toBeVisible();

      // Assert chronological status history timeline steps
      await expect(
        residentDetailModal.getByRole('heading', {
          name: 'Tiến trình Xử lý & Lịch sử Trạng thái',
        }),
      ).toBeVisible();
      await expect(residentDetailModal.getByText('Tạo kiến nghị mới')).toBeVisible();
      await expect(residentDetailModal.getByText('Tiếp nhận xử lý kiến nghị')).toBeVisible();
      await expect(residentDetailModal.getByText(PETITION.resolveNote)).toBeVisible();
      await expect(residentDetailModal.getByText(LEADER.fullName).first()).toBeVisible();

      // Close detail modal
      const closeResDetailBtn = residentDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
        exact: true,
      });
      await expect(closeResDetailBtn).toBeVisible();
      await closeResDetailBtn.click();

      await logoutUser(page, RESIDENT.fullName);
    });
  });
});
