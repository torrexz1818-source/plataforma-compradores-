import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

type SendPasswordResetOtpData = {
  to: string;
  code: string;
  fullName: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from = process.env.SMTP_FROM ?? 'no-reply@supplyconnect.local';
  private readonly transporter: Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !portRaw || !user || !pass) {
      this.transporter = null;
      this.logger.warn(
        'SMTP config is missing. OTP emails will be logged instead of sent.',
      );
      return;
    }

    const port = Number(portRaw);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async sendPasswordResetOtp(data: SendPasswordResetOtpData): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `Password reset OTP for ${data.to}: ${data.code} (email provider not configured)`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: data.to,
      subject: 'Codigo de recuperacion de SupplyConnect',
      text: `Hola ${data.fullName}, tu codigo de verificacion es ${data.code}. Este codigo vence en 10 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2>Recuperacion de contrasena</h2>
          <p>Hola <strong>${data.fullName}</strong>,</p>
          <p>Tu codigo de verificacion es:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${data.code}</p>
          <p>Este codigo vence en <strong>10 minutos</strong>.</p>
          <p>Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      `,
    });
  }
}
