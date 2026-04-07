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
  private readonly from = 'torrexz1818@gmail.com';
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'torrexz1818@gmail.com',
        pass: 'avqd megm xptk rhqa',
      },
    });
  }

  async sendPasswordResetOtp(data: SendPasswordResetOtpData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Soporte SupplyConnect" <${this.from}>`,
        to: data.to,
        subject: 'Codigo de recuperacion',
        text: `Hola ${data.fullName}, tu codigo es ${data.code}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Recuperar contraseña</h2>
            <p>Hola <strong>${data.fullName}</strong>,</p>
            <p>Tu codigo es:</p>
            <h1 style="letter-spacing: 5px;">${data.code}</h1>
            <p>Este codigo expira en 10 minutos.</p>
          </div>
        `,
      });

      console.log('✅ Correo enviado a:', data.to);
    } catch (error) {
      console.error('❌ Error enviando correo:', error);
      throw new Error('No se pudo enviar el correo');
    }
  }
}