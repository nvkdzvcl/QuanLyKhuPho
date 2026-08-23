'use client';

import React, { useState } from 'react';
import { Modal } from '@quanlykhupho/ui';
import { AccountStatus, UserDto } from '@quanlykhupho/shared-types';
import { useAuth } from '../../lib/auth-context';
import { AccountStatusModal } from './account-status-modal';
import { OtpStep } from './otp-step';
import { PhoneStep } from './phone-step';
import { RegisterStep } from './register-step';

interface AuthFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthStep = 'PHONE' | 'OTP' | 'REGISTER' | 'REGISTER_SUCCESS';

export function AuthFlowModal({ isOpen, onClose }: AuthFlowModalProps) {
  const { setUser } = useAuth();
  const [step, setStep] = useState<AuthStep>('PHONE');
  const [phone, setPhone] = useState('');
  const [retryAfter, setRetryAfter] = useState(60);
  const [expiresIn, setExpiresIn] = useState(300);
  const [registerToken, setRegisterToken] = useState<string | null>(null);

  // Status modal state
  const [statusModalInfo, setStatusModalInfo] = useState<{
    isOpen: boolean;
    status: AccountStatus | null;
    message?: string;
    reason?: string;
  }>({
    isOpen: false,
    status: null,
  });

  const resetFlow = () => {
    setStep('PHONE');
    setPhone('');
    setRegisterToken(null);
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const handleOtpSent = (
    phoneNumber: string,
    retry: number,
    expires: number,
  ) => {
    setPhone(phoneNumber);
    setRetryAfter(retry);
    setExpiresIn(expires);
    setStep('OTP');
  };

  const handleLoginSuccess = (user: UserDto) => {
    setUser(user);
    handleClose();
  };

  const handleNeedsRegistration = (token: string) => {
    setRegisterToken(token);
    setStep('REGISTER');
  };

  const handleAccountStatusBlocked = (
    status: AccountStatus,
    reason?: string,
    message?: string,
  ) => {
    setStatusModalInfo({
      isOpen: true,
      status,
      reason,
      message,
    });
  };

  const handleRegisteredSuccess = (_user: UserDto, message: string) => {
    // Show pending modal
    setStatusModalInfo({
      isOpen: true,
      status: AccountStatus.PENDING,
      message,
    });
    handleClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title=""
        maxWidth="md"
      >
        <div className="pt-2">
          {step === 'PHONE' && <PhoneStep onOtpSent={handleOtpSent} />}

          {step === 'OTP' && (
            <OtpStep
              phoneNumber={phone}
              initialRetryAfter={retryAfter}
              initialExpiresIn={expiresIn}
              onLoginSuccess={handleLoginSuccess}
              onNeedsRegistration={handleNeedsRegistration}
              onAccountStatusBlocked={handleAccountStatusBlocked}
              onBack={() => setStep('PHONE')}
            />
          )}

          {step === 'REGISTER' && registerToken && (
            <RegisterStep
              registerToken={registerToken}
              phoneNumber={phone}
              onRegisteredSuccess={handleRegisteredSuccess}
              onBackToPhone={() => setStep('PHONE')}
            />
          )}
        </div>
      </Modal>

      <AccountStatusModal
        isOpen={statusModalInfo.isOpen}
        status={statusModalInfo.status}
        message={statusModalInfo.message}
        reason={statusModalInfo.reason}
        onClose={() =>
          setStatusModalInfo({
            isOpen: false,
            status: null,
          })
        }
      />
    </>
  );
}
