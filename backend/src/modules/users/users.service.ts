import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from './domain/user.model';
import { UserRole } from './domain/user-role.enum';
import { UserStatus } from './domain/user-status.enum';

type CreateUserData = Pick<
  User,
  'email' | 'passwordHash' | 'fullName' | 'company' | 'position'
>;

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createUser(data: CreateUserData): Promise<User> {
    const existingUser = await this.findByEmail(data.email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      company: data.company,
      position: data.position,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      points: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection().insertOne(user);
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.collection().findOne({
      email: email.trim().toLowerCase(),
    });
  }

  findById(id: string): Promise<User | null> {
    return this.collection().findOne({ id });
  }

  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.collection()
      .find({ id: { $in: Array.from(new Set(ids)) } })
      .toArray();
  }

  list(): Promise<User[]> {
    return this.collection().find().sort({ createdAt: -1 }).toArray();
  }

  async requireActiveUser(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('User is disabled');
    }

    return user;
  }

  async updateStatus(
    targetUserId: string,
    status: UserStatus,
    actorUserId: string,
  ): Promise<{ user: Omit<User, 'passwordHash'> }> {
    const targetUser = await this.findById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('The only administrator cannot be modified');
    }

    if (targetUser.id === actorUserId) {
      throw new ForbiddenException('You cannot change your own status');
    }

    const updatedUser: User = {
      ...targetUser,
      status,
      updatedAt: new Date(),
    };

    await this.collection().updateOne(
      { id: targetUserId },
      {
        $set: {
          status: updatedUser.status,
          updatedAt: updatedUser.updatedAt,
        },
      },
    );

    return {
      user: this.toSafeUser(updatedUser),
    };
  }

  toSafeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private collection() {
    return this.databaseService.collection<User>('users');
  }
}
