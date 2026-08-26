import { test, expect, type Page } from '@playwright/test';
import { PetitionCategory } from '@quanlykhupho/shared-types';

/**
 * Deterministic full-stack multi-role browser journey.
 * Exercises real Next.js UI, NestJS API, PostgreSQL (qlkp_e2e), and Redis (DB 15)
 * without mock routes, request interception, or direct database access.
 *
 * Journey flow:
 * 1. Officer authenticates via dev OTP and creates a Leader for KP-01.
 * 2. Resident completes OTP registration for KP-01 and sees pending status.
 * 3. Leader authenticates via dev OTP and approves the pending resident.
 * 4. Resident logs in via dev OTP and submits a new petition.
 * 5. Leader receives the petition, transitions to PROCESSING, and RESOLVES it.
 * 6. Officer inspects ward-wide petition list and verifies resolved petition & history.
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
  const logoutBtn = page.getByRole('button', {
    name: new RegExp(`Đăng xuất tài khoản ${fullName}`, 'i'),
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
  test('serial end-to-end journey across Officer, Resident, and Leader', async ({ page }) => {
    test.setTimeout(120_000);

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
    // STEP 3: Leader login and resident approval
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
        name: '✓ Duyệt',
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

      // Logout Leader
      await logoutUser(page, LEADER.fullName);
    });

    // =========================================================================
    // STEP 4: Resident login and petition creation
    // =========================================================================
    await test.step('4. Resident logs in and creates a petition', async () => {
      await loginWithDevOtp(page, RESIDENT.phone);

      // Verify resident workspace
      await expect(page.getByText(RESIDENT.fullName).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Cư dân · Khu phố 1/i).first()).toBeVisible();

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

      // Fill petition details
      await createPetitionDialog
        .getByLabel('Tiêu đề kiến nghị / phản ánh')
        .fill(PETITION.title);
      await createPetitionDialog
        .getByLabel('Danh mục phản ánh')
        .selectOption(PetitionCategory.INFRASTRUCTURE);
      await createPetitionDialog
        .getByLabel(/Nội dung chi tiết kiến nghị/i)
        .fill(PETITION.description);

      // Submit petition
      const submitPetitionBtn = createPetitionDialog.getByRole('button', {
        name: 'Gửi kiến nghị',
      });
      await expect(submitPetitionBtn).toBeEnabled();
      await submitPetitionBtn.click();

      // Assert success alert and presence in resident petition list
      await expect(
        page.getByText('Đã gửi kiến nghị mới thành công!'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: PETITION.title }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Chờ tiếp nhận').first()).toBeVisible();

      // Logout Resident
      await logoutUser(page, RESIDENT.fullName);
    });

    // =========================================================================
    // STEP 5: Leader handles and resolves the petition
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

      // Locate and click on the resident's petition
      const petitionCard = page.getByRole('heading', { name: PETITION.title });
      await expect(petitionCard).toBeVisible({ timeout: 10_000 });
      await petitionCard.click();

      // Verify detail modal
      const detailModal = page.getByRole('dialog');
      await expect(
        detailModal.getByRole('heading', { name: 'Chi tiết Kiến nghị & Phản ánh' }),
      ).toBeVisible();
      await expect(detailModal.getByText(PETITION.title)).toBeVisible();
      await expect(
        detailModal.getByText(new RegExp(`Người gửi:\\s*${RESIDENT.fullName}`, 'i')),
      ).toBeVisible();

      // Advance status to PROCESSING
      const startProcessingBtn = detailModal.getByRole('button', {
        name: /Tiếp nhận xử lý/i,
      });
      await expect(startProcessingBtn).toBeVisible();
      await startProcessingBtn.click();

      await expect(
        page.getByText('Đã chuyển trạng thái kiến nghị sang "Đang xử lý".'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(detailModal.getByText('Đang xử lý').first()).toBeVisible();

      // Resolve the petition
      const resolveBtn = detailModal.getByRole('button', {
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
      await expect(detailModal.getByText(PETITION.resolveNote)).toBeVisible();

      // Close detail modal
      const closeModalBtn = detailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
      });
      await expect(closeModalBtn).toBeVisible();
      await closeModalBtn.click();

      // Logout Leader
      await logoutUser(page, LEADER.fullName);
    });

    // =========================================================================
    // STEP 6: Officer verifies ward-wide petition visibility and status
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

      // Assert petition is visible in ward scope
      const wardPetition = page.getByRole('heading', { name: PETITION.title });
      await expect(wardPetition).toBeVisible({ timeout: 10_000 });
      const wardPetitionCard = page.getByRole('button').filter({ has: wardPetition });
      await expect(wardPetitionCard.getByText(/Khu phố 1/)).toBeVisible();
      await expect(
        wardPetitionCard.getByText(RESIDENT.fullName, { exact: true }),
      ).toBeVisible();

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

      // Close detail modal
      const closeModalBtn = officerDetailModal.getByRole('button', {
        name: 'Đóng hộp thoại',
      });
      await expect(closeModalBtn).toBeVisible();
      await closeModalBtn.click();

      // Final logout
      await logoutUser(page, OFFICER.fullName);
    });
  });
});
