import { UserDto } from './user';

export interface SendOtpRequestDto {
  phoneNumber: string;
}

export interface SendOtpResponseDto {
  expiresIn: number; // 300 seconds
  retryAfter: number; // 60 seconds
}

export interface VerifyOtpRequestDto {
  phoneNumber: string;
  otpCode: string;
}

export interface VerifyOtpResponseDto {
  isRegistered: boolean;
  registerToken?: string | null;
  accessToken?: string | null;
  user?: UserDto | null;
}

export interface RegisterRequestDto {
  registerToken: string;
  fullName: string;
  address: string;
  neighborhoodId: string;
}

export interface RegisterResponseDto {
  user: UserDto;
  message?: string;
}
