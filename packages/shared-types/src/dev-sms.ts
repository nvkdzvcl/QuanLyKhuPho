export interface DevSmsInboxItemDto {
  commandId: string;
  maskedPhone: string;
  otpCode: string;
  createdAt: string;
}

export type DevSmsInboxResponseDto = DevSmsInboxItemDto[];
