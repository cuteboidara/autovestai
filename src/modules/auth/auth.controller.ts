import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({
    keyPrefix: 'auth-register',
    limit: 10,
    ttlSeconds: 300,
  })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @RateLimit({
    keyPrefix: 'auth-login',
    limit: 20,
    ttlSeconds: 300,
  })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @RateLimit({
    keyPrefix: 'auth-refresh',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user);
  }

  @Public()
  @RateLimit({ keyPrefix: 'auth-forgot-password', limit: 5, ttlSeconds: 900 })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email).then(() => ({
      message: 'If that email exists, a reset link has been sent',
    }));
  }

  @Public()
  @RateLimit({ keyPrefix: 'auth-reset-password', limit: 5, ttlSeconds: 900 })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword).then(() => ({
      message: 'Password reset successfully',
    }));
  }

  @Public()
  @RateLimit({ keyPrefix: 'auth-verify-email', limit: 10, ttlSeconds: 900 })
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token).then(() => ({ message: 'Email verified' }));
  }

  @RateLimit({ keyPrefix: 'auth-resend-verification', limit: 3, ttlSeconds: 3600 })
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resendVerification(user.id).then(() => ({
      message: 'Verification email sent',
    }));
  }
}
