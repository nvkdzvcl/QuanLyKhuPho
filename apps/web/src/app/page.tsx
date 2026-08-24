'use client';

import React, { useState } from 'react';
import { UserRole } from '@quanlykhupho/shared-types';
import { useAuth } from '../lib/auth-context';
import { AuthFlowModal } from '../components/auth/auth-flow-modal';
import { ResidentView } from '../components/dashboard/resident-view';
import { LeaderView } from '../components/dashboard/leader-view';
import { OfficerView } from '../components/dashboard/officer-view';
import { PublicLanding } from '../components/landing/public-landing';

function SessionLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center text-slate-500">
      <svg className="mb-3 h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
      </svg>
      <p className="text-sm font-medium">Đang kiểm tra phiên đăng nhập...</p>
    </div>
  );
}

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  if (user?.role === UserRole.LEADER) {
    return <LeaderView user={user} />;
  }

  if (user?.role === UserRole.OFFICER) {
    return <OfficerView user={user} />;
  }

  if (user?.role === UserRole.RESIDENT) {
    return <ResidentView user={user} />;
  }

  return (
    <>
      <PublicLanding onOpenAuth={() => setIsAuthModalOpen(true)} />
      <AuthFlowModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
