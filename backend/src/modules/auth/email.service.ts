/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

type SendPasswordResetOtpData = {
  to: string;
  code: string;
  fullName: string;
  resetLink?: string;
};

type ExpertAppointmentEmailData = {
  buyerEmail: string;
  expertEmail: string;
  buyerName: string;
  expertName: string;
  startsAt: string;
  topic: string;
  meetLink?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'no-reply@supplynexu.com';
  private readonly transporter: Transporter;

  constructor() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = Number(process.env.SMTP_PORT?.trim() || '587');
    const smtpSecure =
      String(process.env.SMTP_SECURE ?? '')
        .trim()
        .toLowerCase() === 'true';
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    this.transporter = nodemailer.createTransport({
      ...(smtpHost
        ? {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
          }
        : {
            service: 'gmail',
          }),
      ...(smtpUser && smtpPass
        ? {
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {}),
    });
  }

  isConfigured() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    return Boolean(smtpHost && smtpUser && smtpPass);
  }

  getConfigurationStatus() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = process.env.SMTP_PORT?.trim() || '587';
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    return {
      configured: Boolean(smtpHost && smtpUser && smtpPass),
      host: smtpHost || null,
      port: smtpPort,
      hasUser: Boolean(smtpUser),
      hasPassword: Boolean(smtpPass),
      hasFrom: Boolean(this.from),
    };
  }

  async sendPasswordResetOtp(data: SendPasswordResetOtpData): Promise<void> {
    this.ensureConfigured();
    const resetLinkBlock = data.resetLink
      ? `
            <p>Tambien puedes cambiar tu contrasena directamente desde este enlace:</p>
            <p><a href="${data.resetLink}" style="display:inline-block;background:#0E109E;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;">Restablecer contrasena</a></p>
          `
      : '';
    const textLines = [
      `Hola ${data.fullName}, tu codigo es ${data.code}.`,
      data.resetLink ? `Tambien puedes restablecer tu contrasena aqui: ${data.resetLink}` : '',
      'Este acceso expira en 10 minutos.',
    ].filter(Boolean);

    try {
      await this.transporter.sendMail({
        from: `"Soporte Supply Nexu" <${this.from}>`,
        to: data.to,
        subject: 'Recuperacion de contrasena',
        text: textLines.join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Recuperar contrasena</h2>
            <p>Hola <strong>${data.fullName}</strong>,</p>
            <p>Tu codigo de verificacion es:</p>
            <h1 style="letter-spacing: 5px;">${data.code}</h1>
            ${resetLinkBlock}
            <p>Este acceso expira en 10 minutos.</p>
          </div>
        `,
      });

      this.logger.log(`Correo de recuperacion enviado a ${data.to}`);
    } catch (error) {
      this.logger.error(
        `Error enviando correo a ${data.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de recuperacion. Revisa las credenciales SMTP del servidor.',
      );
    }
  }

  async sendExpertAppointmentConfirmation(
    data: ExpertAppointmentEmailData,
  ): Promise<void> {
    this.ensureConfigured();

    const subject = `Confirmacion de reunion con ${data.expertName}`;
    const formattedDate = this.formatDate(data.startsAt);
    const meetLink = data.meetLink ?? 'Pendiente de sincronizacion';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Reunion agendada en Nexu Experts</h2>
        <p>Hola,</p>
        <p>La reunion ha sido confirmada correctamente.</p>
        <p><strong>Experto:</strong> ${data.expertName}</p>
        <p><strong>Comprador:</strong> ${data.buyerName}</p>
        <p><strong>Fecha y hora:</strong> ${formattedDate}</p>
        <p><strong>Tema:</strong> ${data.topic}</p>
        <p><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>
      </div>
    `;

    const text = [
      'Reunion agendada en Nexu Experts',
      `Experto: ${data.expertName}`,
      `Comprador: ${data.buyerName}`,
      `Fecha y hora: ${formattedDate}`,
      `Tema: ${data.topic}`,
      `Google Meet: ${meetLink}`,
    ].join('\n');

    try {
      await this.transporter.sendMail({
        from: `"Supply Nexu" <${this.from}>`,
        to: data.buyerEmail,
        cc: data.expertEmail,
        subject,
        text,
        html,
      });

      this.logger.log(
        `Correo de cita enviado a ${data.buyerEmail} y ${data.expertEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando confirmacion de cita a ${data.buyerEmail} / ${data.expertEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de confirmacion. Revisa las credenciales SMTP del servidor.',
      );
    }
  }

  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'El envio de correos no esta configurado por ahora. Configura SMTP_HOST, SMTP_USER y SMTP_PASS en el servidor.',
      );
    }
  }

  private formatDate(value: string) {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: process.env.APP_TIMEZONE?.trim() || 'America/Lima',
    }).format(new Date(value));
  }
}
