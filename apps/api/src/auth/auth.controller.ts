import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CurrentUserResponseDto,
  RegisterResponseDto,
  SendOtpResponseDto,
  UserDto,
  VerifyOtpResponseDto,
} from '@quanlykhupho/shared-types';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../core/constants';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { Public } from '../security/decorators/public.decorator';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
@UseGuards(CsrfGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body() dto: SendOtpDto,
  ): Promise<SendOtpResponseDto> {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VerifyOtpResponseDto> {
    const { result, sessionId } = await this.authService.verifyOtp(dto);

    if (sessionId) {
      const isProduction = process.env.NODE_ENV === 'production';
      response.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: SESSION_TTL_SECONDS * 1000,
      });
    }

    return result;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(
    @CurrentUser() user: UserDto,
  ): Promise<CurrentUserResponseDto> {
    return { user };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const sessionId =
      request.cookies?.[SESSION_COOKIE_NAME] ||
      request.headers.authorization?.replace('Bearer ', '').trim();

    if (sessionId) {
      await this.authService.logout(sessionId);
    }

    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return { message: 'Đăng xuất thành công' };
  }
}
