import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PushSubscriptionKeysDto } from '@quanlykhupho/shared-types';

export class PushKeysDto implements PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  auth: string;
}

export class RegisterPushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(4096)
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  userAgent?: string;
}

export class UnregisterPushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(4096)
  endpoint: string;
}
