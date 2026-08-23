'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
} from '@quanlykhupho/ui';
import {
  PetitionStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import {
  useCancelPetition,
  usePetitionDetail,
  useUpdatePetitionStatus,
} from '../../hooks/use-petitions';
import { getErrorMessage } from '../../lib/api-client';
import {
  PetitionCategoryBadge,
  PetitionStatusBadge,
} from './petition-status-badge';

interface PetitionDetailModalProps {
  petitionId: string | null;
  onClose: () => void;
  currentUser: UserDto;
  onStatusChanged?: () => void;
}

export function PetitionDetailModal({
  petitionId,
  onClose,
  currentUser,
  onStatusChanged,
}: PetitionDetailModalProps) {
  const { data: petition, isLoading, isError, error } = usePetitionDetail(petitionId);

  const updateStatusMutation = useUpdatePetitionStatus();
  const cancelMutation = useCancelPetition();

  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  // Reject sub-modal
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Resolve sub-modal
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Cancel confirmation sub-modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!petitionId) return null;

  const isAuthor = petition?.authorId === currentUser.id;
  const isOfficer = currentUser.role === UserRole.OFFICER;
  const isNeighborhoodLeader =
    currentUser.role === UserRole.LEADER &&
    petition?.neighborhoodId === currentUser.neighborhoodId;
  const canAdminister = isOfficer || isNeighborhoodLeader;

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const handleStartProcessing = async () => {
    if (!petition) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: petition.id,
        dto: {
          status: PetitionStatus.PROCESSING,
          responseNote: 'Đã tiếp nhận xử lý kiến nghị',
        },
      });
      setToastFeedback({
        variant: 'success',
        message: 'Đã chuyển trạng thái kiến nghị sang "Đang xử lý".',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setToastFeedback({
        variant: 'error',
        message: getErrorMessage(err),
      });
    }
  };

  const handleConfirmResolve = async () => {
    if (!petition) return;
    setResolveError(null);
    try {
      await updateStatusMutation.mutateAsync({
        id: petition.id,
        dto: {
          status: PetitionStatus.RESOLVED,
          responseNote: resolveNote.trim() || 'Đã giải quyết kiến nghị thành công',
        },
      });
      setIsResolveOpen(false);
      setResolveNote('');
      setToastFeedback({
        variant: 'success',
        message: 'Đã đánh dấu kiến nghị là "Đã giải quyết".',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setResolveError(getErrorMessage(err));
    }
  };

  const handleConfirmReject = async () => {
    if (!petition) return;
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối giải quyết kiến nghị.');
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        id: petition.id,
        dto: {
          status: PetitionStatus.REJECTED,
          responseNote: rejectReason.trim(),
        },
      });
      setIsRejectOpen(false);
      setRejectReason('');
      setToastFeedback({
        variant: 'success',
        message: 'Đã từ chối xử lý kiến nghị với lý do được cung cấp.',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setRejectError(getErrorMessage(err));
    }
  };

  const handleConfirmCancel = async () => {
    if (!petition) return;
    try {
      await cancelMutation.mutateAsync({
        id: petition.id,
        dto: {
          reason: cancelReason.trim() || 'Cư dân đã hủy kiến nghị',
        },
      });
      setIsCancelOpen(false);
      setCancelReason('');
      setToastFeedback({
        variant: 'success',
        message: 'Đã hủy kiến nghị thành công.',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      setCancelError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen={Boolean(petitionId)}
      onClose={onClose}
      title="Chi tiết Kiến nghị & Phản ánh"
      maxWidth="xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {toastFeedback && (
          <Alert
            variant={toastFeedback.variant}
            message={toastFeedback.message}
            onClose={() => setToastFeedback(null)}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            <svg className="animate-spin h-6 w-6 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Đang tải thông tin kiến nghị...
          </div>
        ) : isError ? (
          <Alert variant="error" message={getErrorMessage(error)} />
        ) : petition ? (
          <>
            {/* Header & Badges */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PetitionCategoryBadge category={petition.category} />
                  <PetitionStatusBadge status={petition.status} />
                </div>
                <span className="text-xs text-slate-400">
                  Mã: <span className="font-mono">{petition.id.substring(0, 8)}</span> •{' '}
                  {new Date(petition.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {petition.title}
              </h3>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                <span>
                  Khu phố: <strong>{petition.neighborhood?.name || 'Khu phố'}</strong> (
                  {petition.neighborhood?.ward})
                </span>
                <span>•</span>
                <span>
                  Người gửi: <strong>{petition.author.fullName}</strong> ({petition.author.maskedPhone})
                </span>
                {petition.author.address && (
                  <>
                    <span>•</span>
                    <span>Địa chỉ: {petition.author.address}</span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nội dung phản ánh
              </h4>
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap rounded-xl bg-slate-50 p-4 border border-slate-200">
                {petition.description}
              </div>
            </div>

            {/* Evidence Images */}
            {petition.evidence && petition.evidence.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Hình ảnh minh chứng ({petition.evidence.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {petition.evidence.map((ev) => {
                    const downloadUrl = `${apiBaseUrl}/petitions/${petition.id}/evidence/${ev.id}`;
                    return (
                      <a
                        key={ev.id}
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm hover:border-blue-500 hover:shadow-md transition"
                      >
                        <Image
                          src={downloadUrl}
                          alt={ev.originalName}
                          width={300}
                          height={120}
                          unoptimized
                          className="h-28 w-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="p-2 text-[11px] text-slate-700 bg-white/90 backdrop-blur-xs flex items-center justify-between">
                          <span className="truncate max-w-[100px] font-medium">
                            {ev.originalName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {(ev.fileSize / 1024).toFixed(0)} KB 🔍
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Bar based on State & Role */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Thao tác xử lý theo thẩm quyền
                </h4>
                <span className="text-xs text-slate-500">
                  Trạng thái hiện tại: <strong className="text-slate-800">{petition.status}</strong>
                </span>
              </div>

              {/* Resident Author Actions */}
              {isAuthor && petition.status === PetitionStatus.REVIEWING && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setIsCancelOpen(true);
                      setCancelReason('');
                      setCancelError(null);
                    }}
                  >
                    ⊘ Hủy kiến nghị này
                  </Button>
                  <span className="text-xs text-slate-500">
                    (Bạn có thể hủy kiến nghị khi đang trong giai đoạn chờ tiếp nhận)
                  </span>
                </div>
              )}

              {/* Leader / Officer Processing Actions */}
              {canAdminister && (
                <div className="flex flex-wrap items-center gap-2">
                  {petition.status === PetitionStatus.REVIEWING && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleStartProcessing}
                      isLoading={updateStatusMutation.isPending}
                    >
                      ⚙️ Tiếp nhận xử lý
                    </Button>
                  )}

                  {petition.status === PetitionStatus.PROCESSING && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setIsResolveOpen(true);
                          setResolveNote('');
                          setResolveError(null);
                        }}
                      >
                        ✓ Giải quyết thành công
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setIsRejectOpen(true);
                          setRejectReason('');
                          setRejectError(null);
                        }}
                      >
                        ✕ Từ chối kiến nghị
                      </Button>
                    </>
                  )}

                  {[PetitionStatus.RESOLVED, PetitionStatus.REJECTED, PetitionStatus.CANCELLED].includes(
                    petition.status,
                  ) && (
                    <p className="text-xs text-slate-500 italic">
                      Kiến nghị này đã ở trạng thái kết thúc ({petition.status}) và không thể thay đổi thêm.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Status History Timeline (Tiến trình xử lý bất biến) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Tiến trình Xử lý & Lịch sử Trạng thái
              </h4>

              {petition.history && petition.history.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {petition.history.map((step, idx) => (
                    <div key={step.id || idx} className="relative group">
                      {/* Timeline marker */}
                      <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-sm">
                        {idx + 1}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <PetitionStatusBadge status={step.toStatus} />
                            {step.fromStatus && (
                              <span className="text-xs text-slate-400">
                                (từ {step.fromStatus})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(step.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          Thực hiện bởi:{' '}
                          <strong>{step.changedBy?.fullName || 'Người dùng'}</strong>
                          {step.changedBy?.role && (
                            <Badge
                              variant={
                                step.changedBy.role === UserRole.OFFICER
                                  ? 'info'
                                  : step.changedBy.role === UserRole.LEADER
                                  ? 'warning'
                                  : 'default'
                              }
                              className="text-[10px] ml-1.5 py-0 px-1.5"
                            >
                              {step.changedBy.role === UserRole.OFFICER
                                ? 'Cán bộ phường'
                                : step.changedBy.role === UserRole.LEADER
                                ? 'Trưởng khu phố'
                                : 'Cư dân'}
                            </Badge>
                          )}
                        </div>

                        {step.note && (
                          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100 leading-relaxed whitespace-pre-wrap">
                            💬 <strong>Ý kiến / Ghi chú:</strong> {step.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Chưa có lịch sử trạng thái.</p>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Resolve Modal */}
      {isResolveOpen && (
        <Modal
          isOpen={isResolveOpen}
          onClose={() => setIsResolveOpen(false)}
          title="Xác nhận giải quyết kiến nghị"
          description="Đánh dấu kiến nghị đã được xử lý và giải quyết dứt điểm."
        >
          <div className="space-y-3">
            {resolveError && (
              <Alert
                variant="error"
                message={resolveError}
                onClose={() => setResolveError(null)}
              />
            )}
            <Input
              label="Kết quả / Hướng dẫn giải quyết (tùy chọn)"
              placeholder="Ví dụ: Đã hoàn tất sửa chữa nắp cống vào sáng nay..."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResolveOpen(false)}
                disabled={updateStatusMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmResolve}
                isLoading={updateStatusMutation.isPending}
              >
                Xác nhận hoàn thành
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {isRejectOpen && (
        <Modal
          isOpen={isRejectOpen}
          onClose={() => setIsRejectOpen(false)}
          title="Từ chối xử lý kiến nghị"
          description="Vui lòng cung cấp lý do từ chối rõ ràng để thông báo tới cư dân."
        >
          <div className="space-y-3">
            {rejectError && (
              <Alert
                variant="error"
                message={rejectError}
                onClose={() => setRejectError(null)}
              />
            )}
            <Input
              label="Lý do từ chối (bắt buộc)"
              placeholder="Ví dụ: Không thuộc thẩm quyền khu phố, nội dung đã được xử lý..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRejectOpen(false)}
                disabled={updateStatusMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmReject}
                isLoading={updateStatusMutation.isPending}
              >
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelOpen && (
        <Modal
          isOpen={isCancelOpen}
          onClose={() => setIsCancelOpen(false)}
          title="Xác nhận hủy kiến nghị"
          description="Bạn có chắc chắn muốn hủy kiến nghị này? Thao tác này không thể hoàn tác."
        >
          <div className="space-y-3">
            {cancelError && (
              <Alert
                variant="error"
                message={cancelError}
                onClose={() => setCancelError(null)}
              />
            )}
            <Input
              label="Lý do hủy (tùy chọn)"
              placeholder="Ví dụ: Đã giải quyết được, gửi nhầm thông tin..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelOpen(false)}
                disabled={cancelMutation.isPending}
              >
                Không hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                isLoading={cancelMutation.isPending}
              >
                Xác nhận hủy kiến nghị
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
