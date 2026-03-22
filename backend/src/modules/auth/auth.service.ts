import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginRequestDto } from './dto/login.request.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user.model';
import { UserStatus } from '../users/domain/user-status.enum';

type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'fullName'
  | 'company'
  | 'position'
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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
      role: user.role,
      status: user.status,
      points: user.points,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
