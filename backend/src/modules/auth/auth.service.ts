import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { LoginRequestDto } from './dto/login.request.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { EmailService } from './email.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user.model';
import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';

type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'fullName'
  | 'company'
  | 'position'
  | 'sector'
  | 'location'
  | 'description'
  | 'role'
  | 'status'
  | 'points'
  | 'avatarUrl'
> & {
  createdAt: string;
};

type AuthResponse = {
  accessToken: string;
  user: SafeUser;
};

type PasswordResetOtpRecord = {
  id: string;
  email: string;
  userId: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  verifiedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  consumedAt?: Date;
};

type PasswordResetRateLimitRecord = {
  key: string;
  count: number;
  windowStartedAt: Date;
  updatedAt: Date;
};

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX_REQUESTS = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  async register(data: RegisterRequestDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(data.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.createUser({
      email,
      passwordHash,
      fullName: data.fullName,
      company: data.company,
      position: data.position,
      phone: data.phone?.trim(),
      ruc: data.ruc?.trim(),
      sector: data.sector?.trim(),
      location: data.location?.trim(),
      description: data.description?.trim(),
      role: data.role === 'supplier' ? UserRole.SUPPLIER : UserRole.BUYER,
    });

    return {
      accessToken: await this.signToken(user),
      user: this.toSafeUser(user),
    };
  }

  async login(data: LoginRequestDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(data.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('User is disabled');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: await this.signToken(user),
      user: this.toSafeUser(user),
    };
  }

  async me(userId: string): Promise<{ user: SafeUser }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('User is disabled');
    }

    return { user: this.toSafeUser(user) };
  }

  async requestPasswordReset(email: string, ipAddress: string) {
    const normalizedEmail = this.normalizeEmail(email);
    await this.applyOtpRateLimit(normalizedEmail, ipAddress);

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (user) {
      const code = this.generateOtpCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      await this.passwordResetCollection().deleteMany({
        email: normalizedEmail,
        consumedAt: { $exists: false },
      });

      await this.passwordResetCollection().insertOne({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        userId: user.id,
        codeHash: this.hashValue(code),
        attempts: 0,
        expiresAt,
        createdAt: now,
      });

      await this.emailService.sendPasswordResetOtp({
        to: user.email,
        fullName: user.fullName,
        code,
      });
    }

    return {
      message:
        'Si el correo existe en nuestra plataforma, te enviaremos un codigo de verificacion.',
    };
  }

  async verifyPasswordResetCode(email: string, code: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const record = await this.findLatestValidOtpRecord(normalizedEmail);

    if (!record) {
      throw new BadRequestException('Codigo invalido o expirado');
    }

    if (record.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Codigo invalido o expirado');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Codigo invalido o expirado');
    }

    if (record.codeHash !== this.hashValue(code.trim())) {
      await this.passwordResetCollection().updateOne(
        { id: record.id },
        {
          $set: {
            attempts: record.attempts + 1,
          },
        },
      );
      throw new BadRequestException('Codigo invalido o expirado');
    }

    const resetToken = crypto.randomUUID();
    const resetTokenHash = this.hashValue(resetToken);
    const now = new Date();

    await this.passwordResetCollection().updateOne(
      { id: record.id },
      {
        $set: {
          verifiedAt: now,
          resetTokenHash,
          resetTokenExpiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
        },
      },
    );

    return {
      message: 'Codigo verificado correctamente',
      resetToken,
    };
  }

  async resetPasswordWithToken(
    email: string,
    resetToken: string,
    newPassword: string,
  ) {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new BadRequestException('La nueva contrasena debe tener al menos 6 caracteres');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const record = await this.passwordResetCollection().findOne({
      email: normalizedEmail,
      resetTokenHash: this.hashValue(resetToken.trim()),
      consumedAt: { $exists: false },
    });

    if (
      !record ||
      !record.resetTokenExpiresAt ||
      record.resetTokenExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Solicitud de recuperacion invalida o expirada');
    }

    const user = await this.usersService.findById(record.userId);

    if (!user) {
      throw new BadRequestException('Solicitud de recuperacion invalida o expirada');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);

    await this.passwordResetCollection().updateMany(
      { email: normalizedEmail },
      {
        $set: {
          consumedAt: new Date(),
        },
      },
    );

    return { message: 'Contrasena actualizada correctamente' };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async applyOtpRateLimit(email: string, ipAddress: string): Promise<void> {
    const key = this.hashValue(`${ipAddress}|${email}`);
    const now = new Date();
    const current = await this.passwordResetRateLimitCollection().findOne({ key });

    if (!current) {
      await this.passwordResetRateLimitCollection().insertOne({
        key,
        count: 1,
        windowStartedAt: now,
        updatedAt: now,
      });
      return;
    }

    const elapsed = now.getTime() - current.windowStartedAt.getTime();

    if (elapsed > OTP_RATE_LIMIT_WINDOW_MS) {
      await this.passwordResetRateLimitCollection().updateOne(
        { key },
        {
          $set: {
            count: 1,
            windowStartedAt: now,
            updatedAt: now,
          },
        },
      );
      return;
    }

    if (current.count >= OTP_RATE_LIMIT_MAX_REQUESTS) {
      throw new HttpException(
        'Demasiados intentos. Intenta nuevamente en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.passwordResetRateLimitCollection().updateOne(
      { key },
      {
        $set: { updatedAt: now },
        $inc: { count: 1 },
      },
    );
  }

  private async findLatestValidOtpRecord(
    email: string,
  ): Promise<PasswordResetOtpRecord | null> {
    return this.passwordResetCollection()
      .find({
        email,
        consumedAt: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
  }

  private generateOtpCode(): string {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  }

  private hashValue(value: string): string {
    const secret = process.env.JWT_SECRET ?? 'dev-supplyconnect-secret';
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
  }

  private signToken(user: User): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: '24h' },
    );
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      company: user.company,
      position: user.position,
      sector: user.sector,
      location: user.location,
      description: user.description,
      role: user.role,
      status: user.status,
      points: user.points,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private passwordResetCollection() {
    return this.databaseService.collection<PasswordResetOtpRecord>(
      'passwordResetOtps',
    );
  }

  private passwordResetRateLimitCollection() {
    return this.databaseService.collection<PasswordResetRateLimitRecord>(
      'passwordResetRateLimits',
    );
  }
}
