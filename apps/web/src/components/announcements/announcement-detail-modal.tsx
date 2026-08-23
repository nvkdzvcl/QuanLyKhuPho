'use client';

import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Modal,
} from '@quanlykhupho/ui';
import {
  AnnouncementScope,
  CommentDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import {
  useAnnouncementDetail,
  useCreateComment,
  useModerateComment,
} from '../../hooks/use-announcements';
import { getErrorMessage } from '../../lib/api-client';

interface AnnouncementDetailModalProps {
  announcementId: string | null;
  onClose: () => void;
  currentUser: UserDto;
}

export function AnnouncementDetailModal({
  announcementId,
  onClose,
  currentUser,
}: AnnouncementDetailModalProps) {
  const { data: announcement, isLoading, isError, error } = useAnnouncementDetail(announcementId);

  const createCommentMutation = useCreateComment();
  const moderateCommentMutation = useModerateComment();

  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  // Moderate comment modal state
  const [moderatingComment, setModeratingComment] = useState<CommentDto | null>(null);
  const [moderateReason, setModerateReason] = useState('');
  const [moderateError, setModerateError] = useState<string | null>(null);

  if (!announcementId) return null;

  const isOfficer = currentUser.role === UserRole.OFFICER;
  const isLeader =
    currentUser.role === UserRole.LEADER &&
    announcement?.neighborhoodId === currentUser.neighborhoodId;
  const canModerate = isOfficer || isLeader;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    if (!commentText.trim()) {
      setCommentError('Vui lòng nhập nội dung bình luận.');
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        announcementId,
        dto: { content: commentText.trim() },
      });
      setCommentText('');
    } catch (err) {
      setCommentError(getErrorMessage(err));
    }
  };

  const handleModerateSubmit = async () => {
    if (!moderatingComment) return;
    setModerateError(null);

    try {
      await moderateCommentMutation.mutateAsync({
        announcementId,
        commentId: moderatingComment.id,
        dto: {
          isRemoved: true,
          removedReason: moderateReason.trim() || 'Nội dung vi phạm quy chuẩn cộng đồng',
        },
      });
      setModeratingComment(null);
      setModerateReason('');
    } catch (err) {
      setModerateError(getErrorMessage(err));
    }
  };

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  return (
    <Modal
      isOpen={Boolean(announcementId)}
      onClose={onClose}
      title={announcement?.title || 'Chi tiết thông báo'}
      maxWidth="xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            <svg className="animate-spin h-6 w-6 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Đang tải thông báo...
          </div>
        ) : isError ? (
          <Alert variant="error" message={getErrorMessage(error)} />
        ) : announcement ? (
          <>
            {/* Meta header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={announcement.scope === AnnouncementScope.WARD ? 'info' : 'warning'}>
                  {announcement.scope === AnnouncementScope.WARD
                    ? '🌐 Toàn phường'
                    : `🏡 ${announcement.neighborhood?.name || 'Khu phố'}`}
                </Badge>
                <span className="text-xs text-slate-500">
                  Người đăng: <strong>{announcement.author.fullName}</strong> (
                  {announcement.author.role === UserRole.OFFICER
                    ? 'Cán bộ phường'
                    : announcement.author.role === UserRole.LEADER
                    ? 'Trưởng khu phố'
                    : 'Cư dân'}
                  )
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(announcement.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>

            {/* Announcement Content */}
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap rounded-xl bg-slate-50/70 p-4 border border-slate-100">
              {announcement.content}
            </div>

            {/* Attachments Section */}
            {announcement.attachments && announcement.attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tệp đính kèm ({announcement.attachments.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {announcement.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`${apiBaseUrl}/announcements/${announcement.id}/attachments/${att.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 hover:border-blue-500 hover:bg-blue-50/50 transition shadow-sm"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">📎</span>
                        <span className="font-semibold truncate">{att.originalName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-2 font-mono">
                        {(att.fileSize / 1024).toFixed(1)} KB ⬇️
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">
                  Ý kiến đóng góp & Bình luận ({announcement.comments.length})
                </h4>
              </div>

              {/* Comments List */}
              {announcement.comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  Chưa có bình luận nào. Hãy là người đầu tiên đóng góp ý kiến!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {announcement.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-xl border p-3 text-xs transition ${
                        comment.isRemoved
                          ? 'border-red-200 bg-red-50/40 text-slate-400'
                          : 'border-slate-200 bg-slate-50/50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {comment.author.fullName}
                          </span>
                          <Badge
                            variant={
                              comment.author.role === UserRole.OFFICER
                                ? 'info'
                                : comment.author.role === UserRole.LEADER
                                ? 'warning'
                                : 'default'
                            }
                            className="text-[10px] py-0 px-1.5"
                          >
                            {comment.author.role === UserRole.OFFICER
                              ? 'Cán bộ'
                              : comment.author.role === UserRole.LEADER
                              ? 'Trưởng KP'
                              : 'Cư dân'}
                          </Badge>
                          {comment.isRemoved && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              Đã bị ẩn
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            • {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                          {canModerate && !comment.isRemoved && (
                            <button
                              type="button"
                              onClick={() => {
                                setModeratingComment(comment);
                                setModerateReason(comment.removedReason || '');
                                setModerateError(null);
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Kiểm duyệt
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`leading-relaxed ${comment.isRemoved ? 'italic' : ''}`}>
                        {comment.content}
                      </p>

                      {comment.isRemoved && comment.removedReason && (
                        <p className="mt-1 text-[11px] text-red-600 font-medium">
                          Lý do ẩn: {comment.removedReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Input Form */}
              <form onSubmit={handleAddComment} className="space-y-2 pt-2">
                {commentError && (
                  <Alert
                    variant="error"
                    message={commentError}
                    onClose={() => setCommentError(null)}
                  />
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Viết ý kiến đóng góp / bình luận văn minh..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={1000}
                    disabled={createCommentMutation.isPending}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={createCommentMutation.isPending}
                    className="text-xs shrink-0"
                  >
                    Gửi bình luận
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 text-right">
                  {commentText.length}/1000 ký tự
                </p>
              </form>
            </div>
          </>
        ) : null}
      </div>

      {/* Moderation Sub-Modal */}
      {moderatingComment && (
        <Modal
          isOpen={Boolean(moderatingComment)}
          onClose={() => setModeratingComment(null)}
          title="Ẩn bình luận vi phạm"
          description={`Thao tác kiểm duyệt đối với bình luận của: ${moderatingComment.author.fullName}`}
        >
          <div className="space-y-3">
            {moderateError && (
              <Alert
                variant="error"
                message={moderateError}
                onClose={() => setModerateError(null)}
              />
            )}

            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-200">
              {moderatingComment.content}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do ẩn bình luận (tùy chọn)
              </label>
              <input
                type="text"
                maxLength={1000}
                placeholder="Ví dụ: Ngôn từ không phù hợp, spam..."
                value={moderateReason}
                onChange={(e) => setModerateReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModeratingComment(null)}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleModerateSubmit}
                isLoading={moderateCommentMutation.isPending}
              >
                Xác nhận ẩn
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
