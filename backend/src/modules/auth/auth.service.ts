import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { LoginRequestDto } from './dto/login.request.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { EmailService } from './email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { SupplierOnboardingFile, User } from '../users/domain/user.model';
import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';
import { MembershipRecord } from '../users/users.service';

type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'fullName'
  | 'company'
  | 'commercialName'
  | 'position'
  | 'sector'
  | 'location'
  | 'description'
  | 'employeeCount'
  | 'digitalPresence'
  | 'buyerProfile'
  | 'supplierProfile'
  | 'expertProfile'
  | 'role'
  | 'status'
  | 'points'
  | 'avatarUrl'
> & {
  createdAt: string;
  hasSensitiveAccess?: boolean;
  membership?: Omit<MembershipRecord, 'approvedAt' | 'expiresAt' | 'createdAt'> & {
    approvedAt?: string;
    expiresAt?: string;
    createdAt: string;
  } | null;
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

type SupplierOnboardingSessionRecord = {
  id: string;
  shareCount: number;
  requiredShares: number;
  status: 'draft' | 'completed' | 'consumed';
  shareEvents: {
    id: string;
    method: 'copy' | 'native';
    occurredAt: Date;
  }[];
  completedAt?: Date;
  consumedAt?: Date;
  consumedByUserId?: string;
  consumedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

type SupplierOnboardingSessionResponse = {
  session: {
    id: string;
    shareCount: number;
    requiredShares: number;
    remainingShares: number;
    status: 'draft' | 'completed' | 'consumed';
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    consumedAt?: string;
    expiresAt: string;
  };
};

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX_REQUESTS = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const SUPPLIER_ONBOARDING_REQUIRED_SHARES = 3;
const SUPPLIER_ONBOARDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEMPORARY_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
]);
const DUPLICATE_EMAIL_MESSAGE =
  'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.';
const DEFAULT_EXPERT_WEEKLY_AVAILABILITY = [
  {
    day: 'Lunes',
    enabled: true,
    slots: [{ id: 'lunes-1', startTime: '09:00', endTime: '17:00' }],
  },
  {
    day: 'Martes',
    enabled: true,
    slots: [{ id: 'martes-1', startTime: '09:00', endTime: '17:00' }],
  },
  {
    day: 'Miercoles',
    enabled: true,
    slots: [{ id: 'miercoles-1', startTime: '09:00', endTime: '17:00' }],
  },
  {
    day: 'Jueves',
    enabled: true,
    slots: [{ id: 'jueves-1', startTime: '09:00', endTime: '17:00' }],
  },
  {
    day: 'Viernes',
    enabled: true,
    slots: [{ id: 'viernes-1', startTime: '09:00', endTime: '17:00' }],
  },
  {
    day: 'Sabado',
    enabled: false,
    slots: [{ id: 'sabado-1', startTime: '09:00', endTime: '13:00' }],
  },
  {
    day: 'Domingo',
    enabled: false,
    slots: [{ id: 'domingo-1', startTime: '09:00', endTime: '13:00' }],
  },
] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSupplierOnboardingSession(
    existingSessionId?: string,
  ): Promise<SupplierOnboardingSessionResponse> {
    const normalizedExistingSessionId = existingSessionId?.trim();

    if (normalizedExistingSessionId) {
      const existing = await this.supplierOnboardingSessionsCollection().findOne({
        id: normalizedExistingSessionId,
      });

      if (
        existing &&
        existing.status !== 'consumed' &&
        existing.expiresAt.getTime() > Date.now()
      ) {
        return this.toSupplierOnboardingSessionResponse(existing);
      }
    }

    const now = new Date();
    const session: SupplierOnboardingSessionRecord = {
      id: crypto.randomUUID(),
      shareCount: 0,
      requiredShares: SUPPLIER_ONBOARDING_REQUIRED_SHARES,
      status: 'draft',
      shareEvents: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + SUPPLIER_ONBOARDING_TTL_MS),
    };

    await this.supplierOnboardingSessionsCollection().insertOne(session);
    return this.toSupplierOnboardingSessionResponse(session);
  }

  async getSupplierOnboardingSession(
    sessionId: string,
  ): Promise<SupplierOnboardingSessionResponse> {
    const session = await this.requireSupplierOnboardingSession(sessionId, {
      allowConsumed: true,
    });
    return this.toSupplierOnboardingSessionResponse(session);
  }

  async registerSupplierOnboardingShare(
    sessionId: string,
    method?: 'copy' | 'native',
  ): Promise<SupplierOnboardingSessionResponse> {
    const session = await this.requireSupplierOnboardingSession(sessionId);

    if (session.shareCount >= session.requiredShares || session.status === 'completed') {
      return this.toSupplierOnboardingSessionResponse(session);
    }

    const occurredAt = new Date();
    const nextShareCount = Math.min(session.shareCount + 1, session.requiredShares);
    const completedAt =
      nextShareCount >= session.requiredShares ? session.completedAt ?? occurredAt : undefined;

    await this.supplierOnboardingSessionsCollection().updateOne(
      { id: session.id },
      {
        $set: {
          shareCount: nextShareCount,
          status: nextShareCount >= session.requiredShares ? 'completed' : 'draft',
          updatedAt: occurredAt,
          ...(completedAt ? { completedAt } : {}),
        },
        $push: {
          shareEvents: {
            id: crypto.randomUUID(),
            method: method === 'native' ? 'native' : 'copy',
            occurredAt,
          },
        },
      },
    );

    const updated = await this.requireSupplierOnboardingSession(sessionId, {
      allowConsumed: true,
    });
    return this.toSupplierOnboardingSessionResponse(updated);
  }

  async register(data: RegisterRequestDto): Promise<AuthResponse> {
    const email = await this.validateAndNormalizeEmail(data.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
    }

    const supplierOnboardingSession =
      data.role === 'supplier'
        ? await this.requireCompletedSupplierOnboardingSession(
            data.supplierOnboarding?.sessionId,
          )
        : null;

    const passwordHash = await bcrypt.hash(data.password, 10);
    let user: User;
    try {
      user = await this.usersService.createUser({
      email,
      passwordHash,
      fullName: data.fullName,
      company: data.company,
      commercialName: data.commercialName?.trim(),
      position: data.position,
      phone: data.phone?.trim(),
      ruc: data.ruc?.trim(),
      sector: data.sector?.trim(),
      location: data.location?.trim(),
      description: data.description?.trim(),
      employeeCount: data.employeeCount?.trim(),
      digitalPresence: {
        linkedin: data.digitalPresence?.linkedin?.trim(),
        website: data.digitalPresence?.website?.trim(),
        whatsapp: data.digitalPresence?.whatsapp?.trim(),
        instagram: data.digitalPresence?.instagram?.trim(),
      },
      buyerProfile: data.role === 'buyer'
        ? {
            interestCategories: data.buyerProfile?.interestCategories?.map((item) => item.trim()).filter(Boolean),
            purchaseVolume: data.buyerProfile?.purchaseVolume?.trim(),
            isCompanyDigitalized: data.buyerProfile?.isCompanyDigitalized?.trim(),
            usesGenerativeAI: data.buyerProfile?.usesGenerativeAI?.trim(),
          }
        : undefined,
      supplierProfile: data.role === 'supplier'
        ? {
            supplierType: data.supplierProfile?.supplierType?.trim(),
            productsOrServices: data.supplierProfile?.productsOrServices?.map((item) => item.trim()).filter(Boolean),
            hasDigitalCatalog: data.supplierProfile?.hasDigitalCatalog?.trim(),
            isCompanyDigitalized: data.supplierProfile?.isCompanyDigitalized?.trim(),
            usesGenerativeAI: data.supplierProfile?.usesGenerativeAI?.trim(),
            coverage: data.supplierProfile?.coverage?.trim(),
            province: data.supplierProfile?.province?.trim(),
            district: data.supplierProfile?.district?.trim(),
            yearsInMarket: data.supplierProfile?.yearsInMarket?.trim(),
            homologationCertificates:
              data.supplierProfile?.homologationCertificates
                ?.map((file) => this.normalizeUploadedSupplierFile(file))
                .filter((file): file is SupplierOnboardingFile => Boolean(file)),
            logoFile: this.normalizeUploadedSupplierFile(data.supplierProfile?.logoFile),
            catalogFile: this.normalizeUploadedSupplierFile(data.supplierProfile?.catalogFile),
            onboarding: supplierOnboardingSession
              ? {
                  sessionId: supplierOnboardingSession.id,
                  shareCount: supplierOnboardingSession.shareCount,
                  requiredShares: supplierOnboardingSession.requiredShares,
                  completedAt: supplierOnboardingSession.completedAt,
                }
              : undefined,
          }
        : undefined,
      expertProfile: data.role === 'expert'
        ? {
            weeklyAvailability:
              data.expertProfile?.weeklyAvailability?.map((item) => ({
                day: item.day.trim(),
                enabled: Boolean(item.enabled),
                slots: (item.slots || []).map((slot, index) => ({
                  id: slot.id?.trim() || `${item.day.toLowerCase()}-${index + 1}`,
                  startTime: slot.startTime.trim(),
                  endTime: slot.endTime.trim(),
                })),
              })) ||
              DEFAULT_EXPERT_WEEKLY_AVAILABILITY.map((item) => ({
                day: item.day,
                enabled: item.enabled,
                slots: item.slots.map((slot) => ({ ...slot })),
              })),
            currentProfessionalProfile: data.expertProfile?.currentProfessionalProfile?.trim(),
            industry: data.expertProfile?.industry?.trim(),
            specialty: data.expertProfile?.specialty?.trim(),
            experience: data.expertProfile?.experience?.trim(),
            skills: data.expertProfile?.skills?.map((item) => item.trim()).filter(Boolean),
            biography: data.expertProfile?.biography?.trim(),
            companies: data.expertProfile?.companies?.trim(),
            education: data.expertProfile?.education?.trim(),
            achievements: data.expertProfile?.achievements?.trim(),
            photo: data.expertProfile?.photo?.trim(),
            service: data.expertProfile?.service?.trim(),
            availabilityDays: data.expertProfile?.availabilityDays?.map((item) => item.trim()).filter(Boolean),
            googleCalendarConnected: false,
          }
        : undefined,
      role:
        data.role === 'supplier'
          ? UserRole.SUPPLIER
          : data.role === 'expert'
            ? UserRole.EXPERT
            : UserRole.BUYER,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
      }

      throw error;
    }

    if (supplierOnboardingSession) {
      await this.consumeSupplierOnboardingSession(
        supplierOnboardingSession.id,
        user.id,
        email,
      );
    }

    const isBuyer = this.usersService.isBuyerLikeRole(user.role);
    const targetUsers = await this.usersService.listActiveUsersByRolesInSector(
      isBuyer ? [UserRole.SUPPLIER] : [UserRole.BUYER, UserRole.EXPERT],
      user.sector,
      user.id,
    );

    await Promise.all(
      targetUsers.map((targetUser) =>
        this.notificationsService.create({
          icon: 'Building2',
          type: 'NEW_SECTOR_USER',
          title: isBuyer
            ? `Nuevo comprador de tu sector: ${user.fullName}`
            : `Nuevo proveedor de tu sector: ${user.company}`,
          body: `${user.sector?.trim() || 'General'} · ${user.location ?? 'Sin ubicacion'}`,
          entityType: 'user',
          entityId: user.id,
          fromUserId: user.id,
          role: targetUser.role === UserRole.SUPPLIER ? UserRole.SUPPLIER : UserRole.BUYER,
          userId: targetUser.id,
          url: isBuyer
            ? `/directorio-compradores?highlight=${user.id}`
            : `/directorio-proveedores?highlight=${user.id}`,
          time: 'Ahora',
        }),
      ),
    );

    return {
      accessToken: await this.signToken(user),
      user: await this.toSafeUser(user),
    };
  }

  async login(data: LoginRequestDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(data.email);
    let user = await this.usersService.findByEmail(email);

    if (!user && this.isDevelopmentEnvironment()) {
      user = await this.createDevelopmentAccessUser(email, data.password);
    }

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
      user: await this.toSafeUser(user),
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

    return { user: await this.toSafeUser(user) };
  }

  async requestPasswordReset(email: string, ipAddress: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!this.isEmailFormatValid(normalizedEmail)) {
      return {
        message:
          'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
      };
    }
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

      const resetToken = crypto.randomUUID();
      await this.passwordResetCollection().insertOne({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        userId: user.id,
        codeHash: this.hashValue(code),
        attempts: 0,
        expiresAt,
        createdAt: now,
        resetTokenHash: this.hashValue(resetToken),
        resetTokenExpiresAt: expiresAt,
      });

      await this.emailService.sendPasswordResetOtp({
        to: user.email,
        fullName: user.fullName,
        code,
        resetLink: this.buildPasswordResetLink(user.email, resetToken),
      });
    }

    return {
      message:
        'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
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
    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException('La nueva contrasena debe tener al menos 8 caracteres');
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
    return (email ?? '').trim().toLowerCase();
  }

  private normalizeUploadedSupplierFile(file?: {
    url?: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }): SupplierOnboardingFile | undefined {
    const url = file?.url?.trim();

    if (!url) {
      return undefined;
    }

    const normalizedFile: SupplierOnboardingFile = {
      url,
      name: file?.name?.trim() || 'Archivo proveedor',
    };

    const mimeType = file?.mimeType?.trim();
    if (mimeType) {
      normalizedFile.mimeType = mimeType;
    }

    if (typeof file?.size === 'number') {
      normalizedFile.size = file.size;
    }

    return normalizedFile;
  }

  private async validateAndNormalizeEmail(email: string): Promise<string> {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new BadRequestException('El correo es obligatorio');
    }

    if (/\s/.test(normalizedEmail) || !this.isEmailFormatValid(normalizedEmail)) {
      throw new BadRequestException('Ingresa un correo electrónico válido');
    }

    const domain = normalizedEmail.split('@')[1]?.toLowerCase();
    if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
      throw new BadRequestException('Ingresa un correo electrónico válido');
    }

    if (TEMPORARY_EMAIL_DOMAINS.has(domain)) {
      throw new BadRequestException(
        'No se permiten correos temporales. Usa un correo corporativo o personal real.',
      );
    }

    await this.validateEmailWithOptionalProvider(normalizedEmail);
    return normalizedEmail;
  }

  private isEmailFormatValid(email: string): boolean {
    return EMAIL_REGEX.test(email) && email.length <= 254;
  }

  private async validateEmailWithOptionalProvider(email: string): Promise<void> {
    const validationUrl = process.env.EMAIL_VALIDATION_API_URL?.trim();
    const validationToken = process.env.EMAIL_VALIDATION_API_TOKEN?.trim();

    if (!validationUrl) {
      return;
    }

    try {
      const url = new URL(validationUrl);
      url.searchParams.set('email', email);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: validationToken
          ? {
              Authorization: `Bearer ${validationToken}`,
            }
          : undefined,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        valid?: boolean;
        disposable?: boolean;
      };

      if (payload.valid === false || payload.disposable === true) {
        throw new BadRequestException('Ingresa un correo electrónico real y activo');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }
  }

  private buildPasswordResetLink(email: string, resetToken: string): string | undefined {
    const frontendBase =
      process.env.FRONTEND_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      process.env.PUBLIC_APP_URL?.trim();

    if (!frontendBase) {
      return undefined;
    }

    const url = new URL('/forgot-password', frontendBase);
    url.searchParams.set('email', this.normalizeEmail(email));
    url.searchParams.set('token', resetToken);
    return url.toString();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private isDevelopmentEnvironment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private async createDevelopmentAccessUser(
    email: string,
    password: string,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const localPart = email.split('@')[0] ?? 'usuario';
    const normalizedName = localPart
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return this.usersService.createUser({
      email,
      passwordHash,
      fullName: normalizedName || 'Usuario Demo',
      company: 'Supply Nexu',
      position: 'Miembro de la plataforma',
      role: UserRole.BUYER,
    });
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
    const secret = process.env.JWT_SECRET ?? 'dev-supplynexu-secret';
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
  }

  private signToken(user: User): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: '24h' },
    );
  }

  private async requireCompletedSupplierOnboardingSession(
    sessionId?: string,
  ): Promise<SupplierOnboardingSessionRecord> {
    const session = await this.requireSupplierOnboardingSession(sessionId);

    if (session.shareCount < session.requiredShares || session.status !== 'completed') {
      throw new BadRequestException(
        `Comparte el enlace con ${session.requiredShares} personas antes de crear la cuenta de proveedor.`,
      );
    }

    return session;
  }

  private async requireSupplierOnboardingSession(
    sessionId?: string,
    options?: { allowConsumed?: boolean },
  ): Promise<SupplierOnboardingSessionRecord> {
    const normalizedSessionId = sessionId?.trim();

    if (!normalizedSessionId) {
      throw new BadRequestException(
        'La sesion de onboarding del proveedor es obligatoria.',
      );
    }

    const session = await this.supplierOnboardingSessionsCollection().findOne({
      id: normalizedSessionId,
    });

    if (!session) {
      throw new NotFoundException('Sesion de onboarding del proveedor no encontrada.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La sesion de onboarding del proveedor expiro. Genera una nueva y vuelve a compartir.',
      );
    }

    if (!options?.allowConsumed && session.status === 'consumed') {
      throw new BadRequestException(
        'La sesion de onboarding del proveedor ya fue utilizada.',
      );
    }

    return session;
  }

  private async consumeSupplierOnboardingSession(
    sessionId: string,
    userId: string,
    email: string,
  ): Promise<void> {
    const session = await this.requireCompletedSupplierOnboardingSession(sessionId);

    await this.supplierOnboardingSessionsCollection().updateOne(
      { id: session.id },
      {
        $set: {
          status: 'consumed',
          consumedAt: new Date(),
          consumedByUserId: userId,
          consumedByEmail: email,
          updatedAt: new Date(),
        },
      },
    );
  }

  private toSupplierOnboardingSessionResponse(
    session: SupplierOnboardingSessionRecord,
  ): SupplierOnboardingSessionResponse {
    return {
      session: {
        id: session.id,
        shareCount: session.shareCount,
        requiredShares: session.requiredShares,
        remainingShares: Math.max(session.requiredShares - session.shareCount, 0),
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        consumedAt: session.consumedAt?.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  private async toSafeUser(user: User): Promise<SafeUser> {
    const membership = await this.usersService.getMembershipByUserId(user.id);
    const hasSensitiveAccess = await this.usersService.hasSensitiveAccess(user.id);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      company: user.company,
      commercialName: user.commercialName,
      position: user.position,
      sector: user.sector,
      location: user.location,
      description: user.description,
      employeeCount: user.employeeCount,
      digitalPresence: user.digitalPresence,
      buyerProfile: user.buyerProfile,
      supplierProfile: user.supplierProfile,
      expertProfile: user.expertProfile,
      role: user.role,
      status: user.status,
      points: user.points,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      hasSensitiveAccess,
      membership: membership
        ? {
            userId: membership.userId,
            userRole: membership.userRole,
            plan: membership.plan,
            status: membership.status,
            adminApproved: membership.adminApproved,
            approvedBy: membership.approvedBy,
            approvedAt: membership.approvedAt?.toISOString(),
            expiresAt: membership.expiresAt?.toISOString(),
            createdAt: membership.createdAt.toISOString(),
          }
        : null,
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

  private supplierOnboardingSessionsCollection() {
    return this.databaseService.collection<SupplierOnboardingSessionRecord>(
      'supplierOnboardingSessions',
    );
  }
}
