import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthService } from './auth.service';
import { CreateSupplierOnboardingSessionDto } from './dto/create-supplier-onboarding-session.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';
import { ForgotPasswordVerifyDto } from './dto/forgot-password-verify.dto';
import { LoginRequestDto } from './dto/login.request.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { RegisterSupplierShareDto } from './dto/register-supplier-share.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() data: RegisterRequestDto) {
    return this.authService.register(data);
  }

  @Post('supplier-onboarding/session')
  createSupplierOnboardingSession(@Body() data: CreateSupplierOnboardingSessionDto) {
    return this.authService.createSupplierOnboardingSession(data.sessionId);
  }

  @Get('supplier-onboarding/session/:sessionId')
  getSupplierOnboardingSession(@Param('sessionId') sessionId: string) {
    return this.authService.getSupplierOnboardingSession(sessionId);
  }

  @Post('supplier-onboarding/session/:sessionId/share')
  registerSupplierShare(
    @Param('sessionId') sessionId: string,
    @Body() data: RegisterSupplierShareDto,
  ) {
    return this.authService.registerSupplierOnboardingShare(sessionId, data.method);
  }

  @Post('login')
  login(@Body() data: LoginRequestDto) {
    return this.authService.login(data);
  }

  @Post('forgot-password/request')
  requestPasswordReset(
    @Body() data: ForgotPasswordRequestDto,
    @Req() request: Request,
  ) {
    return this.authService.requestPasswordReset(
      data.email,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('forgot-password/verify')
  verifyPasswordReset(@Body() data: ForgotPasswordVerifyDto) {
    return this.authService.verifyPasswordResetCode(data.email, data.code);
  }

  @Post('forgot-password/reset')
  resetPassword(@Body() data: ForgotPasswordResetDto) {
    return this.authService.resetPasswordWithToken(
      data.email,
      data.resetToken,
      data.newPassword,
    );
  }

  @UseGuards(AuthenticatedGuard)
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}
