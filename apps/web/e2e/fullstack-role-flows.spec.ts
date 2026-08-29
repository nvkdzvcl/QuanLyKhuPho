import { test, expect, type Page } from '@playwright/test';
import {
  ActivityFilterCondition,
  ActivityRating,
  AnnouncementScope,
  Gender,
  HighestEducation,
  PartyStatus,
  PetitionCategory,
} from '@quanlykhupho/shared-types';

/**
 * Deterministic full-stack multi-role browser journey.
 * Exercises real Next.js UI, NestJS API, PostgreSQL (qlkp_e2e), and Redis (DB 15)
 * without mock routes, request interception, or direct database access.
 *
 * Journey flow:
 * 1. Officer authenticates via dev OTP and creates a Leader for KP-01.
 * 2. Resident completes OTP registration for KP-01 and sees pending status.
 * 3. Leader authenticates via dev OTP, approves pending resident, exercises resident profile (FR-21/FR-24), activity handoff (FR-23), political-social management (FR-22), and creates KP-01 announcement.
 * 4. Resident logs in via dev OTP, proves in-app notification fallback, comments on announcement, submits primary petition with real in-memory image evidence, and creates and cancels a second reviewing petition with confirmation and history evidence.
 * 5. Leader navigates to Petitions, exercises admin status/category/date filters, opens petition with evidence, advances to PROCESSING, and RESOLVES it with a note; then moderates comment, edits and removes announcement.
 * 6. Officer inspects ward-wide petition list, exercises status filters, verifies resolved petition, evidence & history; then creates a ward-wide announcement.
 * 7. Leader locks resident account, verifies blocked login, unlocks account, and resident logs in again, verifying durable petition status update and ward announcement in notification fallback and feed, followed by final petition status, note, and chronological timeline.
 * 8. Officer inspects ward overview metrics, drills down into neighborhood details, filters petition categories analytics, and previews/downloads periodic report CSV with absence of sensitive fields.
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

const RESIDENT_PROFILE = {
  fullName: 'Phạm Thị Nhân Khẩu E2E',
  citizenId: '079195000123',
  birthDate: '1995-06-15',
  citizenIdIssueDate: '2021-07-20',
  gender: Gender.FEMALE,
  placeOfBirth: 'Bệnh viện Từ Dũ',
  relationshipToHead: 'Chủ hộ',
  householdCode: 'HK-KP01-888',
  permanentAddress: 'Số 789 Đường Số 1, Phường Thử Nghiệm, Quận Thử Nghiệm',
  currentAddress: 'Số 789 Đường Số 1, Phường Thử Nghiệm, TP. Hồ Chí Minh',
  ward: 'Phường Thử Nghiệm',
  city: 'TP. Hồ Chí Minh',
  occupation: 'Kỹ sư phần mềm',
  updatedOccupation: 'Chuyên gia chuyển đổi số',
  updatedCurrentAddress: 'Số 789/2 Đường Số 1, Phường Thử Nghiệm, TP. Hồ Chí Minh',
  phone: '0908765432',
  email: 'pham.thi.nhankhau.e2e@example.com',
  ageFrom: '25',
  ageTo: '35',
  nonMatchingAgeFrom: '60',
  nonMatchingAgeTo: '70',
};

const NEIGHBORHOOD_ACTIVITY = {
  month: '2026-08',
  otherMonth: '2026-07',
  activityDate: '2026-08-20',
  name: 'Họp Tổ dân phố định kỳ tháng 8/2026 E2E',
  updatedName: 'Họp Tổ dân phố định kỳ tháng 8/2026 E2E (Đã đổi lịch)',
  personInCharge: 'Trưởng ban điều hành KP-01',
  updatedPersonInCharge: 'Phó ban điều hành KP-01',
  description: 'Triển khai kế hoạch an ninh trật tự và chuyển đổi số khu phố',
  updatedDescription:
    'Triển khai kế hoạch an ninh trật tự, PCCC và chuyển đổi số khu phố',
  participantNote: 'Tham gia thảo luận đóng góp ý kiến tích cực',
  rating: ActivityRating.GOOD,
  emptyActivityName: 'Sinh hoạt hè thiếu nhi KP-01 E2E',
  emptyActivityDate: '2026-08-28',
};

const POLITICAL_SOCIAL_PROFILE = {
  partyStatus: PartyStatus.PARTY_MEMBER,
  partyAdmissionDate: '2018-02-03',
  highestEducation: HighestEducation.BACHELOR,
  specialty: 'Công nghệ thông tin',
  officialOccupation: 'Kỹ sư giải pháp số',
  strengths: 'Chuyển đổi số cộng đồng và kỹ năng tổ chức phong trào',
  notes: 'Đảng viên trẻ gương mẫu, tích cực tham gia sinh hoạt chi bộ',
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
    test.setTimeout(240_000);

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

      // =======================================================================
      // FR-21 / FR-24 / FR-23: Resident profile creation, edit, combined filters, empty state & activity handoff
      // =======================================================================
      // Navigate to Resident Profiles section
      const residentProfilesNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản lý' })
        .getByRole('button', {
          name: 'Hồ sơ dân cư',
          exact: true,
        });
      await expect(residentProfilesNavBtn).toBeVisible();
      await residentProfilesNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Quản lý Hồ sơ Nhân khẩu' }),
      ).toBeVisible({ timeout: 10_000 });

      // 1. Create complete resident profile
      const openCreateProfileBtn = page.getByRole('button', {
        name: '+ Thêm mới nhân khẩu',
        exact: true,
      });
      await expect(openCreateProfileBtn).toBeVisible();
      await openCreateProfileBtn.click();

      const createProfileModal = page.getByRole('dialog');
      await expect(
        createProfileModal.getByRole('heading', { name: 'Thêm mới Hồ sơ Nhân khẩu' }),
      ).toBeVisible();

      await createProfileModal
        .getByLabel('Họ và tên cư dân')
        .fill(RESIDENT_PROFILE.fullName);
      await createProfileModal
        .getByLabel('Số Căn cước công dân (12 số)')
        .fill(RESIDENT_PROFILE.citizenId);
      await createProfileModal
        .getByLabel('Ngày sinh')
        .fill(RESIDENT_PROFILE.birthDate);
      await createProfileModal
        .getByLabel('Giới tính')
        .selectOption(RESIDENT_PROFILE.gender);
      await createProfileModal
        .getByLabel('Ngày cấp CCCD')
        .fill(RESIDENT_PROFILE.citizenIdIssueDate);
      await createProfileModal
        .getByLabel('Nơi sinh')
        .fill(RESIDENT_PROFILE.placeOfBirth);
      await createProfileModal
        .getByLabel('Nghề nghiệp')
        .fill(RESIDENT_PROFILE.occupation);
      await createProfileModal
        .getByLabel('Mã số hộ khẩu')
        .fill(RESIDENT_PROFILE.householdCode);
      await createProfileModal
        .getByLabel('Quan hệ với chủ hộ')
        .selectOption(RESIDENT_PROFILE.relationshipToHead);
      await createProfileModal
        .getByLabel('Địa chỉ thường trú')
        .fill(RESIDENT_PROFILE.permanentAddress);
      await createProfileModal
        .getByLabel('Địa chỉ tạm trú / hiện tại (nếu khác thường trú)')
        .fill(RESIDENT_PROFILE.currentAddress);
      await createProfileModal
        .getByLabel('Phường/Xã')
        .fill(RESIDENT_PROFILE.ward);
      await createProfileModal
        .getByLabel('Tỉnh/Thành phố')
        .fill(RESIDENT_PROFILE.city);
      await createProfileModal
        .getByLabel('Số điện thoại liên hệ (tùy chọn)')
        .fill(RESIDENT_PROFILE.phone);
      await createProfileModal
        .getByLabel('Email liên hệ (tùy chọn)')
        .fill(RESIDENT_PROFILE.email);

      const submitCreateProfileBtn = createProfileModal.getByRole('button', {
        name: 'Lưu hồ sơ nhân khẩu',
        exact: true,
      });
      await expect(submitCreateProfileBtn).toBeEnabled();
      await submitCreateProfileBtn.click();

      // Verify creation toast and presence in table
      await expect(
        page.getByText(
          new RegExp(
            `Đã thêm hồ sơ nhân khẩu "${RESIDENT_PROFILE.fullName}".*thành công`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 });

      const profileRow = page
        .getByRole('row')
        .filter({ hasText: RESIDENT_PROFILE.fullName });
      await expect(profileRow).toBeVisible({ timeout: 10_000 });

      // 2. Open authorized detail, verify decrypted CCCD, edit occupation/address, and verify persisted values
      const viewDetailBtn = profileRow.getByRole('button', {
        name: 'Xem / Sửa',
        exact: true,
      });
      await expect(viewDetailBtn).toBeVisible();
      await viewDetailBtn.click();

      const profileDetailModal = page.getByRole('dialog');
      await expect(
        profileDetailModal.getByRole('heading', {
          name: new RegExp(`Chi tiết nhân khẩu:\\s*${RESIDENT_PROFILE.fullName}`, 'i'),
        }),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.fullName, { exact: true }),
      ).toBeVisible();
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.citizenId, { exact: true }),
      ).toBeVisible();
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.occupation, { exact: true }),
      ).toBeVisible();
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.currentAddress, { exact: true }),
      ).toBeVisible();
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.ward, { exact: true }),
      ).toBeVisible();
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.city, { exact: true }),
      ).toBeVisible();

      // Trigger edit mode
      const editProfileBtn = profileDetailModal.getByRole('button', {
        name: 'Chỉnh sửa hồ sơ',
        exact: true,
      });
      await expect(editProfileBtn).toBeVisible();
      await editProfileBtn.click();

      await expect(
        profileDetailModal.getByRole('heading', {
          name: new RegExp(`Chỉnh sửa hồ sơ:\\s*${RESIDENT_PROFILE.fullName}`, 'i'),
        }),
      ).toBeVisible();

      await profileDetailModal
        .getByLabel('Nghề nghiệp')
        .fill(RESIDENT_PROFILE.updatedOccupation);
      await profileDetailModal
        .getByLabel('Địa chỉ tạm trú / hiện tại')
        .fill(RESIDENT_PROFILE.updatedCurrentAddress);

      const saveProfileChangesBtn = profileDetailModal.getByRole('button', {
        name: 'Lưu thay đổi',
        exact: true,
      });
      await expect(saveProfileChangesBtn).toBeEnabled();
      await saveProfileChangesBtn.click();

      await expect(
        page.getByText(
          new RegExp(
            `Đã cập nhật hồ sơ nhân khẩu "${RESIDENT_PROFILE.fullName}" thành công`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 });

      // Verify updated values persisted and visible in detail modal
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.updatedOccupation, {
          exact: true,
        }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        profileDetailModal.getByText(RESIDENT_PROFILE.updatedCurrentAddress, {
          exact: true,
        }),
      ).toBeVisible();

      // Close detail modal
      const closeProfileDetailBtn = profileDetailModal.getByRole('button', {
        name: 'Đóng',
        exact: true,
      });
      await expect(closeProfileDetailBtn).toBeVisible();
      await closeProfileDetailBtn.click();
      await expect(profileDetailModal).not.toBeVisible();

      // 3. Combined FR-24 filtering (gender, age range, household relationship, updated occupation, ward)
      const genderFilterSelect = page.getByLabel('Lọc theo giới tính');
      await genderFilterSelect.selectOption(RESIDENT_PROFILE.gender);

      const toggleAdvancedFilterBtn = page.getByRole('button', {
        name: /Bộ lọc nâng cao/i,
      });
      await toggleAdvancedFilterBtn.click();
      await expect(
        page.getByText('Bộ lọc nâng cao nhân khẩu (kết hợp đồng thời - AND)'),
      ).toBeVisible();

      await page.getByLabel('Độ tuổi từ').fill(RESIDENT_PROFILE.ageFrom);
      await page.getByLabel('Độ tuổi đến').fill(RESIDENT_PROFILE.ageTo);

      await page
        .getByLabel('Lọc theo quan hệ với chủ hộ')
        .selectOption(RESIDENT_PROFILE.relationshipToHead);

      await page
        .getByLabel('Lọc theo nghề nghiệp')
        .fill(RESIDENT_PROFILE.updatedOccupation);
      await page
        .getByRole('button', { name: 'Áp dụng lọc nghề nghiệp', exact: true })
        .click();

      await page
        .getByLabel('Lọc theo phường xã')
        .fill(RESIDENT_PROFILE.ward);
      await page
        .getByRole('button', { name: 'Áp dụng lọc phường xã', exact: true })
        .click();

      // Verify created resident is returned
      await expect(
        page.getByRole('row').filter({ hasText: RESIDENT_PROFILE.fullName }),
      ).toBeVisible({ timeout: 10_000 });

      // 4. Force no match by altering one condition, verify filtered-empty state, then restore
      await page.getByLabel('Độ tuổi từ').fill(RESIDENT_PROFILE.nonMatchingAgeFrom);
      await page.getByLabel('Độ tuổi đến').fill(RESIDENT_PROFILE.nonMatchingAgeTo);

      await expect(
        page.getByRole('heading', { name: 'Chưa có hồ sơ nhân khẩu nào' }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText(
          'Không tìm thấy hồ sơ phù hợp với bộ lọc hiện tại. Thử thay đổi tiêu chí tìm kiếm.',
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('row').filter({ hasText: RESIDENT_PROFILE.fullName }),
      ).not.toBeVisible();

      // Restore matching age condition
      await page.getByLabel('Độ tuổi từ').fill(RESIDENT_PROFILE.ageFrom);
      await page.getByLabel('Độ tuổi đến').fill(RESIDENT_PROFILE.ageTo);
      await expect(
        page.getByRole('row').filter({ hasText: RESIDENT_PROFILE.fullName }),
      ).toBeVisible({ timeout: 10_000 });

      // 5. FR-23: Activity creation from filtered list, validation, attendance, edit & monthly retrieval
      const extractToActivityBtn = page.getByRole('button', {
        name: 'Tạo hoạt động từ danh sách',
        exact: true,
      });
      await expect(extractToActivityBtn).toBeVisible();
      await extractToActivityBtn.click();

      const activityModal = page.getByRole('dialog');
      await expect(
        activityModal.getByRole('heading', { name: 'Tạo Hoạt động Khu Phố Mới' }),
      ).toBeVisible({ timeout: 10_000 });

      // Verify custom selection condition is active and 1 extracted resident announced
      const conditionSelect = activityModal.getByLabel(
        'Điều kiện trích xuất danh sách tham gia',
      );
      await expect(conditionSelect).toHaveValue(ActivityFilterCondition.CUSTOM);

      await expect(
        activityModal.getByText(/Đã nhận 1 nhân khẩu từ bộ lọc nâng cao/i),
      ).toBeVisible();
      await expect(
        activityModal.getByText('Chọn nhân khẩu tham gia (1 đã chọn)'),
      ).toBeVisible();

      // Verify created resident is visibly selected (checked)
      const candidateLabel = activityModal
        .locator('label')
        .filter({ hasText: RESIDENT_PROFILE.fullName });
      await expect(candidateLabel.locator('input[type="checkbox"]')).toBeChecked();

      // a. Empty activity name submission shows visible Vietnamese required-name feedback
      const submitCreateActivityBtn = activityModal.getByRole('button', {
        name: 'Tạo hoạt động & Trích xuất danh sách',
        exact: true,
      });
      await activityModal.getByLabel('Tên hoạt động').fill('   ');
      await submitCreateActivityBtn.click();
      await expect(
        activityModal.getByText('Vui lòng nhập tên hoạt động.'),
      ).toBeVisible({ timeout: 10_000 });

      // b. Fill valid activity data and create August 2026 activity with RESIDENT_PROFILE
      await activityModal
        .getByLabel('Tên hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.name);
      await activityModal
        .getByLabel('Ngày diễn ra hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.activityDate);
      await activityModal
        .getByLabel('Người phụ trách')
        .fill(NEIGHBORHOOD_ACTIVITY.personInCharge);
      await activityModal
        .getByLabel('Nội dung / Mô tả hoạt động (tùy chọn)')
        .fill(NEIGHBORHOOD_ACTIVITY.description);

      await submitCreateActivityBtn.click();

      // Verify success feedback toast and modal closure
      await expect(
        page.getByText(
          new RegExp(
            `Đã tạo hoạt động "${NEIGHBORHOOD_ACTIVITY.name}" với danh sách trích xuất 1 nhân khẩu thành công`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: 'Tạo Hoạt động Khu Phố Mới' }),
      ).not.toBeVisible();

      // c. In auto-opened attendance dialog, mark resident present, assign GOOD rating & note, and save
      const attendanceHeading = page.getByRole('heading', {
        name: NEIGHBORHOOD_ACTIVITY.name,
      });
      const attendanceModal = page.getByRole('dialog').filter({
        has: attendanceHeading,
      });
      await expect(attendanceHeading).toBeVisible({ timeout: 10_000 });

      const participantRow = attendanceModal.getByRole('group', {
        name: new RegExp(`Người tham gia:\\s*${RESIDENT_PROFILE.fullName}`, 'i'),
      });
      await expect(participantRow).toBeVisible();

      // Click "Có mặt" button for this participant
      const markPresentBtn = participantRow.getByRole('button', {
        name: 'Có mặt',
        exact: true,
      });
      await markPresentBtn.click();
      await expect(markPresentBtn).toHaveClass(/bg-emerald-600/);

      // Select GOOD rating and fill contribution note
      await participantRow
        .getByRole('combobox', { name: 'Đánh giá' })
        .selectOption(NEIGHBORHOOD_ACTIVITY.rating);
      await participantRow
        .getByPlaceholder('Ghi chú đóng góp...')
        .fill(NEIGHBORHOOD_ACTIVITY.participantNote);

      // Save attendance & evaluation results
      const saveAttendanceBtn = attendanceModal.getByRole('button', {
        name: 'Lưu kết quả điểm danh & đánh giá',
        exact: true,
      });
      await expect(saveAttendanceBtn).toBeEnabled();
      await saveAttendanceBtn.click();

      await expect(
        page.getByText(
          'Đã lưu danh sách điểm danh và đánh giá thành công.',
        ),
      ).toBeVisible({ timeout: 10_000 });

      // Close attendance modal
      const closeAttendanceBtn = attendanceModal.getByRole('button', {
        name: 'Đóng',
        exact: true,
      });
      await closeAttendanceBtn.click();
      await expect(attendanceModal).not.toBeVisible();

      // d. Verify activity row shows 1 present out of 1 participant and edit metadata
      const activityRow = page
        .getByRole('row')
        .filter({ hasText: NEIGHBORHOOD_ACTIVITY.name });
      await expect(activityRow).toBeVisible({ timeout: 10_000 });
      await expect(
        activityRow.getByText(NEIGHBORHOOD_ACTIVITY.personInCharge),
      ).toBeVisible();
      await expect(activityRow.getByText(/1\s*\/\s*1/)).toBeVisible();

      // Open Edit Metadata modal
      const editActivityBtn = activityRow.getByRole('button', {
        name: 'Sửa',
        exact: true,
      });
      await expect(editActivityBtn).toBeVisible();
      await editActivityBtn.click();

      const editMetadataModal = page.getByRole('dialog');
      await expect(
        editMetadataModal.getByRole('heading', {
          name: 'Chỉnh sửa Thông tin Hoạt động',
        }),
      ).toBeVisible({ timeout: 10_000 });

      await editMetadataModal
        .getByLabel('Tên hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.updatedName);
      await editMetadataModal
        .getByLabel('Người phụ trách')
        .fill(NEIGHBORHOOD_ACTIVITY.updatedPersonInCharge);
      await editMetadataModal
        .getByLabel('Mô tả hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.updatedDescription);

      const submitEditBtn = editMetadataModal.getByRole('button', {
        name: 'Cập nhật thông tin',
        exact: true,
      });
      await expect(submitEditBtn).toBeEnabled();
      await submitEditBtn.click();

      await expect(
        page.getByText(
          `Đã cập nhật thông tin hoạt động "${NEIGHBORHOOD_ACTIVITY.updatedName}" thành công.`,
          { exact: true },
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(editMetadataModal).not.toBeVisible();

      // e. Month picker navigation away and back retrieves updated activity and persisted data
      const monthPicker = page.getByLabel('Tháng:');
      await monthPicker.fill(NEIGHBORHOOD_ACTIVITY.otherMonth);
      await expect(
        page.getByRole('row').filter({ hasText: NEIGHBORHOOD_ACTIVITY.updatedName }),
      ).not.toBeVisible();

      await monthPicker.fill(NEIGHBORHOOD_ACTIVITY.month);
      const updatedActivityRow = page
        .getByRole('row')
        .filter({ hasText: NEIGHBORHOOD_ACTIVITY.updatedName });
      await expect(updatedActivityRow).toBeVisible({ timeout: 10_000 });
      await expect(
        updatedActivityRow.getByText(NEIGHBORHOOD_ACTIVITY.updatedPersonInCharge),
      ).toBeVisible();

      // Reopen detail / attendance dialog and prove persisted metadata, note, rating and roster
      const openReopenedDetailBtn = updatedActivityRow.getByRole('button', {
        name: /Điểm danh/i,
      });
      await openReopenedDetailBtn.click();

      const reopenedAttendanceModal = page.getByRole('dialog');
      await expect(
        reopenedAttendanceModal.getByRole('heading', {
          name: NEIGHBORHOOD_ACTIVITY.updatedName,
        }),
      ).toBeVisible({ timeout: 10_000 });

      // Verify persisted metadata summary in modal
      await expect(
        reopenedAttendanceModal.getByText(
          new RegExp(NEIGHBORHOOD_ACTIVITY.updatedDescription, 'i'),
        ),
      ).toBeVisible();
      await expect(
        reopenedAttendanceModal.getByText(
          new RegExp(NEIGHBORHOOD_ACTIVITY.updatedPersonInCharge, 'i'),
        ),
      ).toBeVisible();
      await expect(
        reopenedAttendanceModal.getByText(/Có mặt:\s*1/i),
      ).toBeVisible();

      // Verify persisted participant rating, note, and attendance
      const reopenedParticipantRow = reopenedAttendanceModal.getByRole(
        'group',
        {
          name: new RegExp(`Người tham gia:\\s*${RESIDENT_PROFILE.fullName}`, 'i'),
        },
      );
      await expect(reopenedParticipantRow).toBeVisible();
      await expect(
        reopenedParticipantRow.getByRole('button', {
          name: 'Có mặt',
          exact: true,
        }),
      ).toHaveClass(/bg-emerald-600/);
      await expect(
        reopenedParticipantRow.getByRole('combobox', { name: 'Đánh giá' }),
      ).toHaveValue(NEIGHBORHOOD_ACTIVITY.rating);
      await expect(
        reopenedParticipantRow.getByPlaceholder('Ghi chú đóng góp...'),
      ).toHaveValue(NEIGHBORHOOD_ACTIVITY.participantNote);

      // Close reopened modal
      await reopenedAttendanceModal
        .getByRole('button', { name: 'Đóng', exact: true })
        .click();
      await expect(reopenedAttendanceModal).not.toBeVisible();

      // f. Create second activity with UNDER_18 condition proving no-match warning & empty detail roster
      const openCreateNewActivityBtn = page.getByRole('button', {
        name: '+ Tạo hoạt động mới',
        exact: true,
      });
      await expect(openCreateNewActivityBtn).toBeVisible();
      await openCreateNewActivityBtn.click();

      const secondActivityModal = page.getByRole('dialog');
      await expect(
        secondActivityModal.getByRole('heading', {
          name: 'Tạo Hoạt động Khu Phố Mới',
        }),
      ).toBeVisible({ timeout: 10_000 });

      await secondActivityModal
        .getByLabel('Tên hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.emptyActivityName);
      await secondActivityModal
        .getByLabel('Ngày diễn ra hoạt động')
        .fill(NEIGHBORHOOD_ACTIVITY.emptyActivityDate);
      await secondActivityModal
        .getByLabel('Điều kiện trích xuất danh sách tham gia')
        .selectOption(ActivityFilterCondition.UNDER_18);

      const submitSecondActivityBtn = secondActivityModal.getByRole('button', {
        name: 'Tạo hoạt động & Trích xuất danh sách',
        exact: true,
      });
      await expect(submitSecondActivityBtn).toBeEnabled();
      await submitSecondActivityBtn.click();

      // Verify no-match warning feedback
      await expect(
        page.getByText(
          new RegExp(
            `Đã tạo hoạt động "${NEIGHBORHOOD_ACTIVITY.emptyActivityName}".*Không có nhân khẩu nào phù hợp`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: 'Tạo Hoạt động Khu Phố Mới' }),
      ).not.toBeVisible();

      // In auto-opened detail modal, verify empty participant roster and disabled save button
      const secondDetailHeading = page.getByRole('heading', {
        name: NEIGHBORHOOD_ACTIVITY.emptyActivityName,
      });
      const secondDetailModal = page.getByRole('dialog').filter({
        has: secondDetailHeading,
      });
      await expect(secondDetailHeading).toBeVisible({ timeout: 10_000 });
      await expect(
        secondDetailModal.getByText(
          'Danh sách người tham gia hoạt động này hiện đang trống.',
        ),
      ).toBeVisible();
      await expect(
        secondDetailModal.getByRole('button', {
          name: 'Lưu kết quả điểm danh & đánh giá',
          exact: true,
        }),
      ).toBeDisabled();

      // Close second detail modal
      await secondDetailModal
        .getByRole('button', { name: 'Đóng', exact: true })
        .click();
      await expect(secondDetailModal).not.toBeVisible();

      // =======================================================================
      // FR-22: Political & social profile management, validation, upsert & filtering
      // =======================================================================
      // 1. Navigate to Chính trị - Xã hội section
      const politicalSocialNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản lý' })
        .getByRole('button', {
          name: 'Chính trị - Xã hội',
          exact: true,
        });
      await expect(politicalSocialNavBtn).toBeVisible();
      await politicalSocialNavBtn.click();

      await expect(
        page.getByRole('heading', {
          name: 'Thông tin Chính trị - Xã hội Cư dân',
        }),
      ).toBeVisible({ timeout: 10_000 });

      // 2. Search for the resident created earlier
      const searchPoliticalInput = page.getByPlaceholder(
        'Tìm theo họ tên cư dân, mã hộ khẩu...',
      );
      await expect(searchPoliticalInput).toBeVisible();
      await searchPoliticalInput.fill(RESIDENT_PROFILE.fullName);

      const submitPoliticalSearchBtn = page.getByRole('button', {
        name: 'Tìm kiếm',
        exact: true,
      });
      await expect(submitPoliticalSearchBtn).toBeVisible();
      await submitPoliticalSearchBtn.click();

      const residentPoliticalRow = page
        .getByRole('row')
        .filter({ hasText: RESIDENT_PROFILE.fullName });
      await expect(residentPoliticalRow).toBeVisible({ timeout: 10_000 });
      await expect(
        residentPoliticalRow.getByText('Chưa cập nhật'),
      ).toBeVisible();

      // 3. Open setup form modal
      const setupPoliticalBtn = residentPoliticalRow.getByRole('button', {
        name: 'Thiết lập',
        exact: true,
      });
      await expect(setupPoliticalBtn).toBeVisible();
      await setupPoliticalBtn.click();

      const politicalModal = page.getByRole('dialog');
      await expect(
        politicalModal.getByRole('heading', {
          name: 'Cập nhật Thông tin Chính trị - Xã hội',
        }),
      ).toBeVisible({ timeout: 10_000 });

      // 4. Prove party-member date is required by selecting party_member, leaving date empty, and submitting
      await politicalModal
        .getByLabel('Tình trạng Đảng')
        .selectOption(POLITICAL_SOCIAL_PROFILE.partyStatus);

      const savePoliticalBtn = politicalModal.getByRole('button', {
        name: 'Lưu thông tin',
        exact: true,
      });
      await expect(savePoliticalBtn).toBeVisible();
      await savePoliticalBtn.click();

      // Assert visible requirement feedback message
      await expect(
        politicalModal.getByText(
          'Ngày vào Đảng là bắt buộc đối với Đảng viên.',
        ),
      ).toBeVisible({ timeout: 10_000 });

      // 5. Fill every FR-22 field with valid deterministic non-sensitive values
      await politicalModal
        .getByLabel('Ngày vào Đảng')
        .fill(POLITICAL_SOCIAL_PROFILE.partyAdmissionDate);

      await politicalModal
        .getByLabel('Trình độ học vấn cao nhất')
        .selectOption(POLITICAL_SOCIAL_PROFILE.highestEducation);

      await politicalModal
        .getByLabel('Chuyên môn / Chuyên ngành đào tạo')
        .fill(POLITICAL_SOCIAL_PROFILE.specialty);

      await politicalModal
        .getByLabel('Nghề nghiệp / Vị trí công tác chính thức')
        .fill(POLITICAL_SOCIAL_PROFILE.officialOccupation);

      await politicalModal
        .getByLabel('Sở trường / Kỹ năng nổi bật')
        .fill(POLITICAL_SOCIAL_PROFILE.strengths);

      await politicalModal
        .getByLabel('Ghi chú bổ sung')
        .fill(POLITICAL_SOCIAL_PROFILE.notes);

      // Submit valid form
      await savePoliticalBtn.click();

      // Assert success feedback toast and modal closure
      await expect(
        page.getByText(
          new RegExp(
            `Đã cập nhật thông tin chính trị - xã hội cho cư dân "${RESIDENT_PROFILE.fullName}" thành công`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(politicalModal).not.toBeVisible();

      // 6. Filter by party_member and verify row output
      const partyStatusFilter = page.getByLabel('Lọc theo tình trạng Đảng');
      await partyStatusFilter.selectOption(POLITICAL_SOCIAL_PROFILE.partyStatus);

      const filteredPoliticalRow = page
        .getByRole('row')
        .filter({ hasText: RESIDENT_PROFILE.fullName });
      await expect(filteredPoliticalRow).toBeVisible({ timeout: 10_000 });
      await expect(filteredPoliticalRow.getByText('Đảng viên')).toBeVisible();
      await expect(
        filteredPoliticalRow.getByText('Đại học / Cử nhân'),
      ).toBeVisible();
      await expect(
        filteredPoliticalRow.getByText(
          `${POLITICAL_SOCIAL_PROFILE.specialty} / ${POLITICAL_SOCIAL_PROFILE.officialOccupation}`,
        ),
      ).toBeVisible();

      // 7. Reopen modal and verify every persisted FR-22 value
      const updatePoliticalBtn = filteredPoliticalRow.getByRole('button', {
        name: 'Cập nhật',
        exact: true,
      });
      await expect(updatePoliticalBtn).toBeVisible();
      await updatePoliticalBtn.click();

      const reopenedPoliticalModal = page.getByRole('dialog');
      await expect(
        reopenedPoliticalModal.getByRole('heading', {
          name: 'Cập nhật Thông tin Chính trị - Xã hội',
        }),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        reopenedPoliticalModal.getByLabel('Tình trạng Đảng'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.partyStatus);
      await expect(
        reopenedPoliticalModal.getByLabel('Ngày vào Đảng'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.partyAdmissionDate);
      await expect(
        reopenedPoliticalModal.getByLabel('Trình độ học vấn cao nhất'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.highestEducation);
      await expect(
        reopenedPoliticalModal.getByLabel('Chuyên môn / Chuyên ngành đào tạo'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.specialty);
      await expect(
        reopenedPoliticalModal.getByLabel(
          'Nghề nghiệp / Vị trí công tác chính thức',
        ),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.officialOccupation);
      await expect(
        reopenedPoliticalModal.getByLabel('Sở trường / Kỹ năng nổi bật'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.strengths);
      await expect(
        reopenedPoliticalModal.getByLabel('Ghi chú bổ sung'),
      ).toHaveValue(POLITICAL_SOCIAL_PROFILE.notes);

      // Close reopened modal
      const closePoliticalModalBtn = reopenedPoliticalModal.getByRole('button', {
        name: 'Hủy',
        exact: true,
      });
      await expect(closePoliticalModalBtn).toBeVisible();
      await closePoliticalModalBtn.click();
      await expect(reopenedPoliticalModal).not.toBeVisible();

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

    // =========================================================================
    // STEP 8: Officer inspects ward overview, drills down into neighborhood, filters analytics, and previews/exports periodic report CSV
    // =========================================================================
    await test.step('8. Officer inspects ward overview, neighborhood drill-down, petition categories, and exports periodic report CSV', async () => {
      // 1. Officer authenticates
      await loginWithDevOtp(page, OFFICER.phone);
      await expect(page.getByText('Cán bộ địa phương').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(OFFICER.fullName).first()).toBeVisible();

      // 2. FR-17: Ward Overview Metrics & Per-Neighborhood Summary List
      await expect(page.getByRole('button', { name: /khu phố/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /cư dân/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /kiến nghị/i }).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Kiến nghị theo danh mục' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Tiến độ xử lý theo khu phố' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Tình hình các khu phố' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Khu phố 1' })).toBeVisible();

      // 3. FR-18: Neighborhood Drill-down
      const analyticsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản trị địa bàn' })
        .getByRole('button', {
          name: 'Khu phố',
          exact: true,
        });
      await expect(analyticsNavBtn).toBeVisible();
      await analyticsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Tổng quan địa bàn phường' }),
      ).toBeVisible({ timeout: 10_000 });

      // Open KP-01 drill-down
      const viewKp1Btn = page.getByRole('button', {
        name: 'Xem chi tiết Khu phố 1',
      });
      await expect(viewKp1Btn).toBeVisible({ timeout: 10_000 });
      await viewKp1Btn.click();

      // Verify drill-down identity and scoped metrics
      await expect(
        page.getByRole('heading', { name: 'Chi tiết khu phố' }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole('heading', { name: /Khu phố 1\s*\(KP-01\)/i }),
      ).toBeVisible();
      await expect(page.getByText('Cư dân hoạt động')).toBeVisible();
      await expect(page.getByText('Thông báo đã đăng')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Kiến nghị gần đây' }),
      ).toBeVisible();
      await expect(page.getByText(PETITION.title)).toBeVisible();

      // Close drill-down
      const closeDrilldownBtn = page.getByRole('button', {
        name: 'Đóng chi tiết khu phố',
      });
      await expect(closeDrilldownBtn).toBeVisible();
      await closeDrilldownBtn.click();
      await expect(
        page.getByRole('heading', { name: 'Chi tiết khu phố' }),
      ).not.toBeVisible();

      // 4. FR-19: Petition Category Analytics Filtering
      await expect(
        page.getByRole('heading', { name: 'Phân bố kiến nghị theo nhóm vấn đề' }),
      ).toBeVisible();
      const chartCaption = page.locator('#petition-chart-caption');
      await expect(chartCaption).toBeVisible({ timeout: 10_000 });
      await expect(chartCaption).toContainText(/Tổng cộng/i);

      // Filter by neighborhood KP-01
      const neighborhoodSelect = page
        .getByRole('region', { name: 'Khu phố' })
        .getByLabel('Khu phố', { exact: true });
      await neighborhoodSelect.selectOption({ label: 'Khu phố 1 (KP-01)' });
      const applyFilterBtn = page.getByRole('button', {
        name: 'Áp dụng',
        exact: true,
      });
      await expect(applyFilterBtn).toBeEnabled();
      await applyFilterBtn.click();

      await expect(chartCaption).toContainText(/Tổng cộng/i);
      await expect(page.getByText('Hạ tầng')).toBeVisible();

      // Filter with historical date range yielding zero results (no-data state)
      await page.getByLabel('Từ ngày').fill('2000-01-01');
      await page.getByLabel('Đến ngày').fill('2000-01-02');
      await applyFilterBtn.click();

      await expect(chartCaption).toHaveText(
        'Tổng cộng 0 kiến nghị trong phạm vi đã chọn',
        { timeout: 10_000 },
      );

      // Reset filters
      const clearFilterBtn = page.getByRole('button', {
        name: 'Xóa lọc',
        exact: true,
      });
      await expect(clearFilterBtn).toBeVisible();
      await clearFilterBtn.click();
      await expect(chartCaption).not.toHaveText(
        'Tổng cộng 0 kiến nghị trong phạm vi đã chọn',
        { timeout: 10_000 },
      );

      // 5. FR-20: Periodic Report Preview & CSV Export
      const reportsNavBtn = page
        .getByRole('navigation', { name: 'Điều hướng quản trị địa bàn' })
        .getByRole('button', {
          name: 'Báo cáo',
          exact: true,
        });
      await expect(reportsNavBtn).toBeVisible();
      await reportsNavBtn.click();

      await expect(
        page.getByRole('heading', { name: 'Báo cáo Định kỳ Toàn Phường' }),
      ).toBeVisible({ timeout: 10_000 });

      // Trigger preview for selected month/quarter
      const previewReportBtn = page.getByRole('button', {
        name: 'Xem trước báo cáo',
        exact: true,
      });
      await expect(previewReportBtn).toBeVisible();
      await previewReportBtn.click();

      // Verify report metadata, warnings/sufficiency status, and summary metrics
      await expect(page.getByText(/Phạm vi:.*UTC/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.getByText(/Dữ liệu đầy đủ|Cần lưu ý/i).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Tổng hợp toàn Phường' }),
      ).toBeVisible();
      await expect(page.getByText('Cư dân hoạt động').first()).toBeVisible();
      await expect(page.getByText('Đăng ký mới trong kỳ').first()).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Chi tiết số liệu theo từng Khu phố' }),
      ).toBeVisible();
      await expect(page.getByRole('cell', { name: 'KP-01' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Khu phố 1' })).toBeVisible();

      // Trigger real CSV download and assert event, safe filename, UTF-8 BOM, aggregate content, and sensitive data exclusion
      const downloadPromise = page.waitForEvent('download');
      const exportCsvBtn = page.getByRole('button', {
        name: 'Xuất file CSV (UTF-8)',
        exact: true,
      });
      await expect(exportCsvBtn).toBeVisible();
      await exportCsvBtn.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(
        /^bao-cao-khu-pho-(?:thang|quy)-\d+-\d{4}\.csv$/,
      );

      const stream = await download.createReadStream();
      expect(stream).toBeTruthy();
      const chunks: Buffer[] = [];
      if (stream) {
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }
      const csvContent = Buffer.concat(chunks).toString('utf8');

      // Verify UTF-8 BOM prefix (\uFEFF)
      expect(csvContent.startsWith('\uFEFF')).toBe(true);

      // Verify aggregate section headings and contents
      expect(csvContent).toContain('BÁO CÁO ĐỊNH KỲ TÌNH HÌNH QUẢN LÝ ĐỊA BÀN PHƯỜNG');
      expect(csvContent).toContain('THÔNG TIN BÁO CÁO');
      expect(csvContent).toContain('TỔNG HỢP TOÀN PHƯỜNG');
      expect(csvContent).toContain('CHI TIẾT THEO TỪNG KHU PHỐ');
      expect(csvContent).toContain('KP-01');
      expect(csvContent).toContain('Khu phố 1');

      // Verify absence of sensitive person-level fields
      expect(csvContent).not.toContain(OFFICER.phone);
      expect(csvContent).not.toContain(LEADER.phone);
      expect(csvContent).not.toContain(RESIDENT.phone);
      expect(csvContent).not.toContain(RESIDENT.fullName);
      expect(csvContent).not.toContain('CCCD');
      expect(csvContent).not.toContain('CMND');

      // Logout Officer
      await logoutUser(page, OFFICER.fullName);
    });
  });
});
