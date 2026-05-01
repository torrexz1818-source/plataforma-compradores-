import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { EmailService } from './modules/auth/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      ok: true,
      message: 'Backend funcionando correctamente',
      email: this.emailService.getConfigurationStatus(),
      googleCalendar: {
        mode: process.env.GOOGLE_CALENDAR_MODE?.trim() || 'real',
        hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
        hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
        hasRedirectUri: Boolean(process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()),
        hasGlobalRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim()),
      },
    };
  }
}
