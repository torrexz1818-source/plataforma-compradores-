import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { ExpertsService } from './experts.service';

@Controller('experts')
@UseGuards(AuthenticatedGuard)
export class ExpertsController {
  constructor(private readonly expertsService: ExpertsService) {}

  @Get()
  async listExperts(@CurrentUser() user: { sub: string } | undefined) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return {
      items: await this.expertsService.listExperts(),
    };
  }

  @Get('appointments/mine')
  async getMyAppointments(
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getDashboard(user.sub, user.role);
  }

  @Get('me/calendar')
  async getMyCalendarConnection(
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getMyCalendarConnection(user.sub);
  }

  @Get('me/calendar/oauth-url')
  async getMyCalendarOauthUrl(
    @CurrentUser() user: { sub: string } | undefined,
    @Query('frontendPath') frontendPath?: string,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getCalendarOAuthUrl(user.sub, {
      frontendPath,
    });
  }

  @Get('me/availability')
  async getMyAvailabilitySettings(
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getMyAvailabilitySettings(user.sub);
  }

  @Post('me/availability')
  async updateMyAvailabilitySettings(
    @Body()
    body: {
      weeklyAvailability?: Array<{
        day: string;
        enabled: boolean;
        slots: Array<{
          id: string;
          startTime: string;
          endTime: string;
        }>;
      }>;
    },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!Array.isArray(body.weeklyAvailability) || body.weeklyAvailability.length === 0) {
      throw new BadRequestException(
        'La disponibilidad semanal es obligatoria',
      );
    }

    return this.expertsService.updateMyAvailabilitySettings(user.sub, {
      weeklyAvailability: body.weeklyAvailability,
    });
  }

  @Post('me/calendar/connect')
  async connectMyCalendar(
    @Body()
    body: {
      refreshToken?: string;
      calendarId?: string;
      timezone?: string;
      googleEmail?: string;
    },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.refreshToken?.trim()) {
      throw new BadRequestException(
        'El refresh token de Google es obligatorio',
      );
    }

    return this.expertsService.connectMyCalendar(user.sub, {
      refreshToken: body.refreshToken,
      calendarId: body.calendarId,
      timezone: body.timezone,
      googleEmail: body.googleEmail,
    });
  }

  @Post('me/calendar/disconnect')
  async disconnectMyCalendar(
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.disconnectMyCalendar(user.sub);
  }

  @Get(':id/availability')
  async getAvailability(
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getExpertAvailability(id, date);
  }

  @Get(':id')
  async getExpertProfile(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.getExpertProfile(id);
  }

  @Post('appointments')
  async createAppointment(
    @Body() body: { expertId?: string; startsAt?: string; topic?: string },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.expertId?.trim()) {
      throw new BadRequestException('El experto es obligatorio');
    }

    if (!body.startsAt?.trim()) {
      throw new BadRequestException('La fecha y hora son obligatorias');
    }

    if (!body.topic?.trim()) {
      throw new BadRequestException('La descripcion del tema es obligatoria');
    }

    return this.expertsService.createAppointment({
      buyerId: user.sub,
      expertId: body.expertId,
      startsAt: body.startsAt,
      topic: body.topic,
    });
  }

  @Patch('appointments/:id')
  async rescheduleAppointment(
    @Param('id') id: string,
    @Body() body: { startsAt?: string },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.startsAt?.trim()) {
      throw new BadRequestException('La nueva fecha y hora son obligatorias');
    }

    return this.expertsService.rescheduleAppointment({
      appointmentId: id,
      userId: user.sub,
      startsAt: body.startsAt,
    });
  }

  @Delete('appointments/:id')
  async cancelAppointment(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.expertsService.cancelAppointment({
      appointmentId: id,
      userId: user.sub,
    });
  }
}

@Controller('experts')
export class ExpertsOauthController {
  constructor(private readonly expertsService: ExpertsService) {}

  @Get('calendar/oauth/callback')
  async calendarOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const frontendBase =
      process.env.FRONTEND_URL?.trim() || 'http://127.0.0.1:5173';

    if (error) {
      const redirectUrl = new URL('/calendar-setup', frontendBase);
      redirectUrl.searchParams.set('calendar', 'error');
      redirectUrl.searchParams.set('reason', error);
      return response.redirect(HttpStatus.FOUND, redirectUrl.toString());
    }

    if (!code || !state) {
      const redirectUrl = new URL('/calendar-setup', frontendBase);
      redirectUrl.searchParams.set('calendar', 'error');
      redirectUrl.searchParams.set('reason', 'missing_parameters');
      return response.redirect(HttpStatus.FOUND, redirectUrl.toString());
    }

    try {
      const result = await this.expertsService.completeCalendarOAuth(code, state);
      const redirectUrl = new URL(result.frontendPath, frontendBase);
      redirectUrl.searchParams.set('calendar', 'connected');
      redirectUrl.searchParams.set('provider', 'google');
      return response.redirect(HttpStatus.FOUND, redirectUrl.toString());
    } catch (callbackError) {
      const redirectUrl = new URL('/calendar-setup', frontendBase);
      redirectUrl.searchParams.set('calendar', 'error');
      redirectUrl.searchParams.set(
        'reason',
        callbackError instanceof Error ? callbackError.message : 'oauth_failed',
      );
      return response.redirect(HttpStatus.FOUND, redirectUrl.toString());
    }
  }
}
