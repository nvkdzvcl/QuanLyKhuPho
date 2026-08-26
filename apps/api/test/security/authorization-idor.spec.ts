import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  AccountStatus,
  type ApiErrorEnvelope,
  type ApiResponseEnvelope,
  type CurrentUserResponseDto,
  type DevSmsInboxItemDto,
  ErrorCode,
  Gender,
  type NeighborhoodDto,
  PetitionCategory,
  type PetitionDto,
  type PetitionListResponseDto,
  PetitionStatus,
  type RegisterResponseDto,
  type ResidentProfileDetailDto,
  type ResidentProfileListResponseDto,
  type SendOtpResponseDto,
  type UserDto,
  UserRole,
  type VerifyOtpResponseDto,
} from '@quanlykhupho/shared-types';

/**
 * Real-Stack Security Authorization and IDOR Acceptance Harness.
 *
 * Implements the 10-point authorization and object-scoping acceptance matrix:
 * 1. Unauthenticated GET returns 401 UNAUTHORIZED.
 * 2. Resident cannot perform admin, leader creation, petition status updates, or exports (403 FORBIDDEN).
 * 3. Leader KP-01 cannot see, approve, or lock residents in KP-02; own neighborhood isolation holds.
 * 4. Resident petition lists are self-scoped; cross-resident and cross-neighborhood lookups concealed (404 PETITION_NOT_FOUND).
 * 5. Leader KP-01 cross-neighborhood petition status mutation is rejected (403 FORBIDDEN).
 * 6. Petition evidence download is scoped to authorized parties; cross-resident and cross-leader IDOR is rejected without returning bytes.
 * 7. Resident profile management is strictly neighborhood-scoped for Leaders; filter params cannot widen scope; cross update/detail rejected; resident role is forbidden; officer sees both.
 * 8. Resident export is forbidden for residents; leader KP-01 export includes only KP-01; officer export includes both; raw sensitive values are masked.
 * 9. Officer petition list observes petitions across all neighborhoods.
 * 10. Locking an active resident immediately revokes active sessions, returning 401 UNAUTHORIZED on subsequent requests.
 */

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Polls the loopback-only dev SMS inbox for newly dispatched OTP codes
 * using opaque command IDs without leaking phone numbers or codes.
 */
async function fetchNewOtpCode(
  apiContext: APIRequestContext,
  initialCommandIds: Set<string>,
): Promise<string> {
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const inboxRes = await apiContext.get('/api/dev/sms-inbox');
    if (inboxRes.ok()) {
      const inboxEnvelope =
        (await inboxRes.json()) as ApiResponseEnvelope<DevSmsInboxItemDto[]>;
      if (inboxEnvelope.success && Array.isArray(inboxEnvelope.data)) {
        const matched = inboxEnvelope.data.find(
          (item) => !initialCommandIds.has(item.commandId),
        );
        if (matched && matched.otpCode && /^\d{6}$/.test(matched.otpCode)) {
          return matched.otpCode;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for newly dispatched OTP in dev SMS inbox');
}

/**
 * Executes a full OTP request and verification flow on the given context.
 */
async function sendOtpAndVerify(
  apiContext: APIRequestContext,
  phoneNumber: string,
): Promise<VerifyOtpResponseDto> {
  const initialInboxRes = await apiContext.get('/api/dev/sms-inbox');
  expect(initialInboxRes.status()).toBe(200);
  const initialInboxEnvelope =
    (await initialInboxRes.json()) as ApiResponseEnvelope<DevSmsInboxItemDto[]>;
  expect(initialInboxEnvelope.success).toBe(true);
  const initialCommandIds = new Set(
    initialInboxEnvelope.data.map((item) => item.commandId),
  );

  const sendOtpRes = await apiContext.post('/api/auth/send-otp', {
    data: { phoneNumber },
  });
  expect(sendOtpRes.status()).toBe(200);
  const sendOtpEnvelope =
    (await sendOtpRes.json()) as ApiResponseEnvelope<SendOtpResponseDto>;
  expect(sendOtpEnvelope.success).toBe(true);

  const otpCode = await fetchNewOtpCode(apiContext, initialCommandIds);

  const verifyOtpRes = await apiContext.post('/api/auth/verify-otp', {
    data: { phoneNumber, otpCode },
  });
  expect(verifyOtpRes.status()).toBe(200);
  const verifyEnvelope =
    (await verifyOtpRes.json()) as ApiResponseEnvelope<VerifyOtpResponseDto>;
  expect(verifyEnvelope.success).toBe(true);

  return verifyEnvelope.data;
}

/**
 * Registers a new resident account via legitimate HTTP OTP + Register endpoint.
 */
async function registerResident(
  apiContext: APIRequestContext,
  phoneNumber: string,
  fullName: string,
  address: string,
  neighborhoodId: string,
): Promise<UserDto> {
  const verifyData = await sendOtpAndVerify(apiContext, phoneNumber);
  expect(verifyData.isRegistered).toBe(false);
  expect(verifyData.registerToken).toBeDefined();

  const registerRes = await apiContext.post('/api/auth/register', {
    data: {
      registerToken: verifyData.registerToken!,
      fullName,
      address,
      neighborhoodId,
    },
  });
  expect(registerRes.status()).toBe(201);
  const registerEnvelope =
    (await registerRes.json()) as ApiResponseEnvelope<RegisterResponseDto>;
  expect(registerEnvelope.success).toBe(true);
  expect(registerEnvelope.data.user.status).toBe(AccountStatus.PENDING);

  return registerEnvelope.data.user;
}

/**
 * Asserts error status and errorCode payload on failed API requests.
 */
async function assertErrorResponse(
  response: { status: () => number; json: () => Promise<unknown> },
  expectedStatus: number,
  expectedErrorCode?: ErrorCode,
): Promise<ApiErrorEnvelope> {
  expect(response.status()).toBe(expectedStatus);
  const body = (await response.json()) as ApiErrorEnvelope;
  expect(body.success).toBe(false);
  expect(body.statusCode).toBe(expectedStatus);
  if (expectedErrorCode) {
    expect(body.errorCode).toBe(expectedErrorCode);
  }
  return body;
}

test.describe.serial('Real-Stack Security Authorization & IDOR Acceptance Gate', () => {
  let anonContext: APIRequestContext;
  let officerContext: APIRequestContext;
  let leader1Context: APIRequestContext;
  let leader2Context: APIRequestContext;
  let resident1Context: APIRequestContext;
  let resident2Context: APIRequestContext;
  let pendingResidentContext: APIRequestContext;

  let neighborhoodKp01: NeighborhoodDto;
  let neighborhoodKp02: NeighborhoodDto;

  let resident1User: UserDto;
  let resident2User: UserDto;
  let pendingResidentUser: UserDto;

  let petition1: PetitionDto;
  let petition2: PetitionDto;
  let evidence1Id: string;

  let profile1: ResidentProfileDetailDto;
  let profile2: ResidentProfileDetailDto;

  test.beforeAll(async ({ playwright, baseURL }) => {
    const defaultBaseUrl = baseURL || 'http://localhost:4100';
    const requestOptions = {
      baseURL: defaultBaseUrl,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Origin: defaultBaseUrl,
      },
    };

    anonContext = await playwright.request.newContext(requestOptions);
    officerContext = await playwright.request.newContext(requestOptions);
    leader1Context = await playwright.request.newContext(requestOptions);
    leader2Context = await playwright.request.newContext(requestOptions);
    resident1Context = await playwright.request.newContext(requestOptions);
    resident2Context = await playwright.request.newContext(requestOptions);
    pendingResidentContext = await playwright.request.newContext(requestOptions);

    // 1. Discover target neighborhoods dynamically from public endpoint
    const nRes = await anonContext.get('/api/neighborhoods');
    expect(nRes.status()).toBe(200);
    const nEnvelope =
      (await nRes.json()) as ApiResponseEnvelope<NeighborhoodDto[]>;
    expect(nEnvelope.success).toBe(true);

    const foundKp01 = nEnvelope.data.find((n) => n.code === 'KP-01');
    const foundKp02 = nEnvelope.data.find((n) => n.code === 'KP-02');
    expect(foundKp01, 'KP-01 neighborhood must exist').toBeDefined();
    expect(foundKp02, 'KP-02 neighborhood must exist').toBeDefined();
    neighborhoodKp01 = foundKp01!;
    neighborhoodKp02 = foundKp02!;

    // 2. Authenticate bootstrapped officer
    const officerPhone = process.env.BOOTSTRAP_OFFICER_PHONE || '0901234567';
    await sendOtpAndVerify(officerContext, officerPhone);

    const officerMeRes = await officerContext.get('/api/auth/me');
    expect(officerMeRes.status()).toBe(200);
    const officerMeEnvelope =
      (await officerMeRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
    expect(officerMeEnvelope.data.user.role).toBe(UserRole.OFFICER);
    expect(officerMeEnvelope.data.user.status).toBe(AccountStatus.ACTIVE);

    // 3. Officer provisions Leader 1 (KP-01) and Leader 2 (KP-02)
    const leader1Phone = '0911000001';
    const leader2Phone = '0922000002';

    const l1Res = await officerContext.post('/api/users/leaders', {
      data: {
        phoneNumber: leader1Phone,
        fullName: 'Trưởng Khu Phố 1',
        neighborhoodId: neighborhoodKp01.id,
      },
    });
    expect(l1Res.status()).toBe(201);

    const l2Res = await officerContext.post('/api/users/leaders', {
      data: {
        phoneNumber: leader2Phone,
        fullName: 'Trưởng Khu Phố 2',
        neighborhoodId: neighborhoodKp02.id,
      },
    });
    expect(l2Res.status()).toBe(201);

    // 4. Authenticate Leader 1 and Leader 2
    await sendOtpAndVerify(leader1Context, leader1Phone);
    const l1MeRes = await leader1Context.get('/api/auth/me');
    expect(l1MeRes.status()).toBe(200);
    const l1MeEnv =
      (await l1MeRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
    expect(l1MeEnv.data.user.role).toBe(UserRole.LEADER);
    expect(l1MeEnv.data.user.neighborhoodId).toBe(neighborhoodKp01.id);

    await sendOtpAndVerify(leader2Context, leader2Phone);
    const l2MeRes = await leader2Context.get('/api/auth/me');
    expect(l2MeRes.status()).toBe(200);
    const l2MeEnv =
      (await l2MeRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
    expect(l2MeEnv.data.user.role).toBe(UserRole.LEADER);
    expect(l2MeEnv.data.user.neighborhoodId).toBe(neighborhoodKp02.id);

    // 5. Resident 1 registers in KP-01, approved by Leader 1, and logs in
    const resident1Phone = '0933000003';
    resident1User = await registerResident(
      resident1Context,
      resident1Phone,
      'Cư Dân Khu Phố Một',
      '10 Đường KP1',
      neighborhoodKp01.id,
    );

    const approve1Res = await leader1Context.patch(
      `/api/users/${resident1User.id}/approve`,
    );
    expect(approve1Res.status()).toBe(200);

    await sendOtpAndVerify(resident1Context, resident1Phone);
    const r1MeRes = await resident1Context.get('/api/auth/me');
    expect(r1MeRes.status()).toBe(200);
    const r1MeEnv =
      (await r1MeRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
    expect(r1MeEnv.data.user.role).toBe(UserRole.RESIDENT);
    expect(r1MeEnv.data.user.status).toBe(AccountStatus.ACTIVE);

    // 6. Resident 2 registers in KP-02, approved by Leader 2, and logs in
    const resident2Phone = '0944000004';
    resident2User = await registerResident(
      resident2Context,
      resident2Phone,
      'Cư Dân Khu Phố Hai',
      '20 Đường KP2',
      neighborhoodKp02.id,
    );

    const approve2Res = await leader2Context.patch(
      `/api/users/${resident2User.id}/approve`,
    );
    expect(approve2Res.status()).toBe(200);

    await sendOtpAndVerify(resident2Context, resident2Phone);
    const r2MeRes = await resident2Context.get('/api/auth/me');
    expect(r2MeRes.status()).toBe(200);
    const r2MeEnv =
      (await r2MeRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
    expect(r2MeEnv.data.user.role).toBe(UserRole.RESIDENT);
    expect(r2MeEnv.data.user.status).toBe(AccountStatus.ACTIVE);

    // 7. Pending Resident registers in KP-02 and remains pending for isolation checks
    const pendingPhone = '0955000005';
    pendingResidentUser = await registerResident(
      pendingResidentContext,
      pendingPhone,
      'Cư Dân Chờ Duyệt KP2',
      '30 Đường KP2',
      neighborhoodKp02.id,
    );
    expect(pendingResidentUser.status).toBe(AccountStatus.PENDING);
  });

  test.afterAll(async () => {
    await Promise.all([
      anonContext?.dispose(),
      officerContext?.dispose(),
      leader1Context?.dispose(),
      leader2Context?.dispose(),
      resident1Context?.dispose(),
      resident2Context?.dispose(),
      pendingResidentContext?.dispose(),
    ]);
  });

  test('Matrix 1: Unauthenticated GET of protected resources returns 401 UNAUTHORIZED', async () => {
    const meRes = await anonContext.get('/api/auth/me');
    await assertErrorResponse(meRes, 401, ErrorCode.UNAUTHORIZED);

    const pendingRes = await anonContext.get('/api/users/pending');
    await assertErrorResponse(pendingRes, 401, ErrorCode.UNAUTHORIZED);

    const petitionsRes = await anonContext.get('/api/petitions');
    await assertErrorResponse(petitionsRes, 401, ErrorCode.UNAUTHORIZED);

    const profilesRes = await anonContext.get('/api/resident-profiles');
    await assertErrorResponse(profilesRes, 401, ErrorCode.UNAUTHORIZED);

    const exportsRes = await anonContext.get('/api/exports/residents');
    await assertErrorResponse(exportsRes, 401, ErrorCode.UNAUTHORIZED);

    const wardOverviewRes = await anonContext.get('/api/dashboard/ward-overview');
    await assertErrorResponse(wardOverviewRes, 401, ErrorCode.UNAUTHORIZED);
  });

  test('Matrix 2: Resident cannot access pending-user administration, create leaders, change petition status, or export residents (403 FORBIDDEN)', async () => {
    const pendingRes = await resident1Context.get('/api/users/pending');
    await assertErrorResponse(pendingRes, 403, ErrorCode.FORBIDDEN);

    const approveRes = await resident1Context.patch(
      `/api/users/${resident1User.id}/approve`,
    );
    await assertErrorResponse(approveRes, 403, ErrorCode.FORBIDDEN);

    const createLeaderRes = await resident1Context.post('/api/users/leaders', {
      data: {
        phoneNumber: '0999000000',
        fullName: 'Trưởng Khu Phố Mạo Danh',
        neighborhoodId: neighborhoodKp01.id,
      },
    });
    await assertErrorResponse(createLeaderRes, 403, ErrorCode.FORBIDDEN);

    const dummyPetitionId = '00000000-0000-4000-8000-000000000001';
    const mutateStatusRes = await resident1Context.patch(
      `/api/petitions/${dummyPetitionId}/status`,
      {
        data: {
          status: PetitionStatus.PROCESSING,
        },
      },
    );
    await assertErrorResponse(mutateStatusRes, 403, ErrorCode.FORBIDDEN);

    const exportRes = await resident1Context.get('/api/exports/residents');
    await assertErrorResponse(exportRes, 403, ErrorCode.FORBIDDEN);
  });

  test('Matrix 3: Leader KP-01 cannot see/approve/lock the pending or active resident from KP-02; own pending/list behavior remains correct', async () => {
    // Leader KP-01 pending list must not contain KP-02 pending resident
    const l1PendingRes = await leader1Context.get('/api/users/pending');
    expect(l1PendingRes.status()).toBe(200);
    const l1PendingEnv =
      (await l1PendingRes.json()) as ApiResponseEnvelope<UserDto[]>;
    expect(l1PendingEnv.success).toBe(true);
    expect(
      l1PendingEnv.data.some((u) => u.id === pendingResidentUser.id),
      'Leader KP-01 must not see pending resident from KP-02',
    ).toBe(false);

    // Leader KP-01 cannot approve pending resident from KP-02
    const approveCrossRes = await leader1Context.patch(
      `/api/users/${pendingResidentUser.id}/approve`,
    );
    await assertErrorResponse(approveCrossRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-01 cannot reject pending resident from KP-02
    const rejectCrossRes = await leader1Context.patch(
      `/api/users/${pendingResidentUser.id}/reject`,
      {
        data: {
          reason: 'Từ chối ngoài phạm vi khu phố',
        },
      },
    );
    await assertErrorResponse(rejectCrossRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-01 cannot lock active resident from KP-02
    const lockCrossRes = await leader1Context.patch(
      `/api/users/${resident2User.id}/lock`,
      {
        data: {
          reason: 'Khóa ngoài phạm vi khu phố',
        },
      },
    );
    await assertErrorResponse(lockCrossRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-02 sees the pending resident in KP-02
    const l2PendingRes = await leader2Context.get('/api/users/pending');
    expect(l2PendingRes.status()).toBe(200);
    const l2PendingEnv =
      (await l2PendingRes.json()) as ApiResponseEnvelope<UserDto[]>;
    expect(l2PendingEnv.success).toBe(true);
    expect(
      l2PendingEnv.data.some((u) => u.id === pendingResidentUser.id),
      'Leader KP-02 must see pending resident in KP-02',
    ).toBe(true);
  });

  test('Matrix 4: Residents petition lists contain only their own petition; direct cross-resident detail/cancel and cross-neighborhood leader detail are concealed with 404 PETITION_NOT_FOUND', async () => {
    // Resident 1 creates petition in KP-01 with in-memory PNG evidence
    const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
    const createP1Res = await resident1Context.post('/api/petitions', {
      multipart: {
        title: 'Kiến nghị sửa đèn chiếu sáng KP1',
        description: 'Đèn đường số 10 hỏng bóng cần thay thế.',
        category: PetitionCategory.INFRASTRUCTURE,
        files: {
          name: 'evidence-kp1.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });
    expect(createP1Res.status()).toBe(201);
    const p1Env =
      (await createP1Res.json()) as ApiResponseEnvelope<PetitionDto>;
    expect(p1Env.success).toBe(true);
    petition1 = p1Env.data;
    expect(petition1.evidence.length).toBeGreaterThan(0);
    evidence1Id = petition1.evidence[0]!.id;

    // Resident 2 creates petition in KP-02
    const createP2Res = await resident2Context.post('/api/petitions', {
      multipart: {
        title: 'Kiến nghị dọn dẹp vệ sinh KP2',
        description: 'Khu vực bãi tập kết rác cần xử lý vệ sinh.',
        category: PetitionCategory.SANITATION,
      },
    });
    expect(createP2Res.status()).toBe(201);
    const p2Env =
      (await createP2Res.json()) as ApiResponseEnvelope<PetitionDto>;
    expect(p2Env.success).toBe(true);
    petition2 = p2Env.data;

    // Resident 1 list contains only petition 1
    const r1ListRes = await resident1Context.get('/api/petitions');
    expect(r1ListRes.status()).toBe(200);
    const r1ListEnv =
      (await r1ListRes.json()) as ApiResponseEnvelope<PetitionListResponseDto>;
    expect(r1ListEnv.data.items.some((p) => p.id === petition1.id)).toBe(true);
    expect(r1ListEnv.data.items.some((p) => p.id === petition2.id)).toBe(false);

    // Resident 2 list contains only petition 2
    const r2ListRes = await resident2Context.get('/api/petitions');
    expect(r2ListRes.status()).toBe(200);
    const r2ListEnv =
      (await r2ListRes.json()) as ApiResponseEnvelope<PetitionListResponseDto>;
    expect(r2ListEnv.data.items.some((p) => p.id === petition2.id)).toBe(true);
    expect(r2ListEnv.data.items.some((p) => p.id === petition1.id)).toBe(false);

    // Resident 1 cross-accesses petition 2 -> 404 PETITION_NOT_FOUND
    const r1CrossGetRes = await resident1Context.get(
      `/api/petitions/${petition2.id}`,
    );
    await assertErrorResponse(r1CrossGetRes, 404, ErrorCode.PETITION_NOT_FOUND);

    // Resident 2 cross-cancels petition 1 -> 404 PETITION_NOT_FOUND
    const r2CrossCancelRes = await resident2Context.patch(
      `/api/petitions/${petition1.id}/cancel`,
      {
        data: {
          reason: 'Hủy kiến nghị của người khác',
        },
      },
    );
    await assertErrorResponse(
      r2CrossCancelRes,
      404,
      ErrorCode.PETITION_NOT_FOUND,
    );

    // Leader KP-01 cross-detail access on petition 2 -> 404 PETITION_NOT_FOUND
    const l1CrossGetRes = await leader1Context.get(
      `/api/petitions/${petition2.id}`,
    );
    await assertErrorResponse(l1CrossGetRes, 404, ErrorCode.PETITION_NOT_FOUND);

    // Leader KP-02 cross-detail access on petition 1 -> 404 PETITION_NOT_FOUND
    const l2CrossGetRes = await leader2Context.get(
      `/api/petitions/${petition1.id}`,
    );
    await assertErrorResponse(l2CrossGetRes, 404, ErrorCode.PETITION_NOT_FOUND);
  });

  test('Matrix 5: Leader KP-01 cross-neighborhood petition status mutation is 403 FORBIDDEN', async () => {
    const mutateCrossRes = await leader1Context.patch(
      `/api/petitions/${petition2.id}/status`,
      {
        data: {
          status: PetitionStatus.PROCESSING,
        },
      },
    );
    await assertErrorResponse(mutateCrossRes, 403, ErrorCode.FORBIDDEN);
  });

  test('Matrix 6: Petition evidence download works for authorized owner/leader scope and cross-resident/cross-leader IDOR download is rejected without returning bytes', async () => {
    // Authorized: Resident 1 downloads own petition evidence
    const r1DownloadRes = await resident1Context.get(
      `/api/petitions/${petition1.id}/evidence/${evidence1Id}`,
    );
    expect(r1DownloadRes.status()).toBe(200);
    const r1Bytes = await r1DownloadRes.body();
    expect(r1Bytes.length).toBeGreaterThan(0);
    expect(r1DownloadRes.headers()['content-type']).toContain('image/png');

    // Authorized: Leader KP-01 downloads resident 1 petition evidence
    const l1DownloadRes = await leader1Context.get(
      `/api/petitions/${petition1.id}/evidence/${evidence1Id}`,
    );
    expect(l1DownloadRes.status()).toBe(200);
    const l1Bytes = await l1DownloadRes.body();
    expect(l1Bytes.length).toBeGreaterThan(0);

    // Authorized: Officer downloads petition evidence
    const offDownloadRes = await officerContext.get(
      `/api/petitions/${petition1.id}/evidence/${evidence1Id}`,
    );
    expect(offDownloadRes.status()).toBe(200);
    const offBytes = await offDownloadRes.body();
    expect(offBytes.length).toBeGreaterThan(0);

    // IDOR Negative: Resident 2 attempts to download resident 1 petition evidence
    const r2IdorRes = await resident2Context.get(
      `/api/petitions/${petition1.id}/evidence/${evidence1Id}`,
    );
    await assertErrorResponse(r2IdorRes, 404, ErrorCode.PETITION_NOT_FOUND);

    // IDOR Negative: Leader KP-02 attempts to download resident 1 petition evidence
    const l2IdorRes = await leader2Context.get(
      `/api/petitions/${petition1.id}/evidence/${evidence1Id}`,
    );
    await assertErrorResponse(l2IdorRes, 404, ErrorCode.PETITION_NOT_FOUND);
  });

  test('Matrix 7: Each leader creates one resident profile in their own neighborhood; cross-neighborhood list filter cannot widen leader scope; cross detail/update is rejected; resident role is forbidden; officer sees both', async () => {
    // Leader 1 creates profile in KP-01
    const createP1Res = await leader1Context.post('/api/resident-profiles', {
      data: {
        fullName: 'Nguyễn Văn Hồ Sơ Một',
        citizenId: '001090000001',
        birthDate: '1990-01-01',
        gender: Gender.MALE,
        permanentAddress: '10 Đường KP1',
        householdCode: 'HK-KP1-01',
        phoneNumber: '0919000001',
      },
    });
    expect(createP1Res.status()).toBe(201);
    const p1Env =
      (await createP1Res.json()) as ApiResponseEnvelope<ResidentProfileDetailDto>;
    expect(p1Env.success).toBe(true);
    profile1 = p1Env.data;
    expect(profile1.neighborhoodId).toBe(neighborhoodKp01.id);

    // Leader 2 creates profile in KP-02
    const createP2Res = await leader2Context.post('/api/resident-profiles', {
      data: {
        fullName: 'Trần Thị Hồ Sơ Hai',
        citizenId: '001095000002',
        birthDate: '1995-02-02',
        gender: Gender.FEMALE,
        permanentAddress: '20 Đường KP2',
        householdCode: 'HK-KP2-02',
        phoneNumber: '0929000002',
      },
    });
    expect(createP2Res.status()).toBe(201);
    const p2Env =
      (await createP2Res.json()) as ApiResponseEnvelope<ResidentProfileDetailDto>;
    expect(p2Env.success).toBe(true);
    profile2 = p2Env.data;
    expect(profile2.neighborhoodId).toBe(neighborhoodKp02.id);

    // Resident role is forbidden on resident-profile operations
    const r1GetListRes = await resident1Context.get('/api/resident-profiles');
    await assertErrorResponse(r1GetListRes, 403, ErrorCode.FORBIDDEN);

    const r1GetDetailRes = await resident1Context.get(
      `/api/resident-profiles/${profile1.id}`,
    );
    await assertErrorResponse(r1GetDetailRes, 403, ErrorCode.FORBIDDEN);

    const r1CreateRes = await resident1Context.post('/api/resident-profiles', {
      data: {
        fullName: 'Cư Dân Tự Tạo Hồ Sơ',
        citizenId: '001099000003',
        birthDate: '1999-03-03',
        permanentAddress: 'Địa chỉ',
        householdCode: 'HK-03',
      },
    });
    await assertErrorResponse(r1CreateRes, 403, ErrorCode.FORBIDDEN);

    const r1UpdateRes = await resident1Context.patch(
      `/api/resident-profiles/${profile1.id}`,
      {
        data: {
          fullName: 'Cư Dân Tự Sửa',
        },
      },
    );
    await assertErrorResponse(r1UpdateRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-01 cannot widen scope by supplying KP-02 neighborhoodId query param
    const l1WidenQueryRes = await leader1Context.get(
      `/api/resident-profiles?neighborhoodId=${neighborhoodKp02.id}`,
    );
    expect(l1WidenQueryRes.status()).toBe(200);
    const l1WidenEnv =
      (await l1WidenQueryRes.json()) as ApiResponseEnvelope<ResidentProfileListResponseDto>;
    expect(l1WidenEnv.data.items.some((p) => p.id === profile1.id)).toBe(true);
    expect(
      l1WidenEnv.data.items.some((p) => p.id === profile2.id),
      'Leader KP-01 must not see profile from KP-02 even with query filter',
    ).toBe(false);

    // Leader KP-01 cannot view detail of profile in KP-02
    const l1CrossDetailRes = await leader1Context.get(
      `/api/resident-profiles/${profile2.id}`,
    );
    await assertErrorResponse(l1CrossDetailRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-01 cannot update profile in KP-02
    const l1CrossUpdateRes = await leader1Context.patch(
      `/api/resident-profiles/${profile2.id}`,
      {
        data: {
          fullName: 'Tên Đổi Trái Phép',
        },
      },
    );
    await assertErrorResponse(l1CrossUpdateRes, 403, ErrorCode.FORBIDDEN);

    // Officer sees both resident profiles
    const offListRes = await officerContext.get('/api/resident-profiles');
    expect(offListRes.status()).toBe(200);
    const offListEnv =
      (await offListRes.json()) as ApiResponseEnvelope<ResidentProfileListResponseDto>;
    expect(offListEnv.data.items.some((p) => p.id === profile1.id)).toBe(true);
    expect(offListEnv.data.items.some((p) => p.id === profile2.id)).toBe(true);
  });

  test('Matrix 8: Resident export is forbidden; leader KP-01 CSV includes only KP-01 fixture and excludes KP-02 fixture; officer CSV includes both; CSV never contains the raw fake phone/citizen ID values', async () => {
    // Resident export is forbidden
    const r1ExportRes = await resident1Context.get(
      '/api/exports/residents?format=csv',
    );
    await assertErrorResponse(r1ExportRes, 403, ErrorCode.FORBIDDEN);

    // Leader KP-01 export includes only KP-01 profile, ignoring cross neighborhoodId param
    const l1ExportRes = await leader1Context.get(
      `/api/exports/residents?format=csv&neighborhoodId=${neighborhoodKp02.id}`,
    );
    expect(l1ExportRes.status()).toBe(200);
    const l1Csv = await l1ExportRes.text();
    expect(
      l1Csv.includes('Nguyễn Văn Hồ Sơ Một'),
      'Leader KP-01 export CSV should include KP-01 profile',
    ).toBe(true);
    expect(
      l1Csv.includes('Trần Thị Hồ Sơ Hai'),
      'Leader KP-01 export CSV should not include KP-02 profile',
    ).toBe(false);

    // Officer export includes profiles across both neighborhoods
    const offExportRes = await officerContext.get(
      '/api/exports/residents?format=csv',
    );
    expect(offExportRes.status()).toBe(200);
    const offCsv = await offExportRes.text();
    expect(
      offCsv.includes('Nguyễn Văn Hồ Sơ Một'),
      'Officer export CSV should include KP-01 profile',
    ).toBe(true);
    expect(
      offCsv.includes('Trần Thị Hồ Sơ Hai'),
      'Officer export CSV should include KP-02 profile',
    ).toBe(true);

    // Raw sensitive citizen IDs and phone numbers must never be disclosed in plaintext
    const rawCid1 = '001090000001';
    const rawCid2 = '001095000002';
    const rawPhone1 = '0919000001';
    const rawPhone2 = '0929000002';

    expect(
      l1Csv.includes(rawCid1),
      'Leader KP-01 export CSV must not contain raw citizen ID 1',
    ).toBe(false);
    expect(
      l1Csv.includes(rawPhone1),
      'Leader KP-01 export CSV must not contain raw phone number 1',
    ).toBe(false);

    expect(
      offCsv.includes(rawCid1),
      'Officer export CSV must not contain raw citizen ID 1',
    ).toBe(false);
    expect(
      offCsv.includes(rawCid2),
      'Officer export CSV must not contain raw citizen ID 2',
    ).toBe(false);
    expect(
      offCsv.includes(rawPhone1),
      'Officer export CSV must not contain raw phone number 1',
    ).toBe(false);
    expect(
      offCsv.includes(rawPhone2),
      'Officer export CSV must not contain raw phone number 2',
    ).toBe(false);
  });

  test('Matrix 9: Officer petition list sees both neighborhoods', async () => {
    const offPetRes = await officerContext.get('/api/petitions');
    expect(offPetRes.status()).toBe(200);
    const offPetEnv =
      (await offPetRes.json()) as ApiResponseEnvelope<PetitionListResponseDto>;
    expect(offPetEnv.success).toBe(true);
    expect(offPetEnv.data.items.some((p) => p.id === petition1.id)).toBe(true);
    expect(offPetEnv.data.items.some((p) => p.id === petition2.id)).toBe(true);
  });

  test('Matrix 10: Leader locks own active resident; that residents existing session immediately receives 401 UNAUTHORIZED on protected access', async () => {
    // Leader 1 locks active Resident 1
    const lockRes = await leader1Context.patch(
      `/api/users/${resident1User.id}/lock`,
      {
        data: {
          reason: 'Vi phạm quy chế khu phố',
        },
      },
    );
    expect(lockRes.status()).toBe(200);
    const lockEnv = (await lockRes.json()) as ApiResponseEnvelope<UserDto>;
    expect(lockEnv.data.status).toBe(AccountStatus.LOCKED);

    // Existing session of Resident 1 immediately receives 401 UNAUTHORIZED on protected routes
    const meRes = await resident1Context.get('/api/auth/me');
    await assertErrorResponse(meRes, 401, ErrorCode.UNAUTHORIZED);

    const petitionsRes = await resident1Context.get('/api/petitions');
    await assertErrorResponse(petitionsRes, 401, ErrorCode.UNAUTHORIZED);
  });
});

