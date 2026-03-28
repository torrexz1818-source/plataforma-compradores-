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
> & {
  role?: UserRole;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
};

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
      phone: data.phone,
      ruc: data.ruc,
      sector: data.sector,
      location: data.location,
      description: data.description,
      role:
        data.role === UserRole.SUPPLIER ? UserRole.SUPPLIER : UserRole.BUYER,
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

  async getBuyerSectors(): Promise<Array<{ sector: string; count: number }>> {
    const rows = await this.collection()
      .aggregate<{ sector?: string; count: number }>([
        {
          $match: {
            role: UserRole.BUYER,
            status: UserStatus.ACTIVE,
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [
                {
                  $let: {
                    vars: {
                      normalizedSector: {
                        $trim: {
                          input: { $ifNull: ['$sector', ''] },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $eq: ['$$normalizedSector', ''] },
                        'General',
                        '$$normalizedSector',
                      ],
                    },
                  },
                },
                'General',
              ],
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            sector: '$_id',
            count: 1,
          },
        },
        {
          $sort: {
            count: -1,
            sector: 1,
          },
        },
      ])
      .toArray();

    return rows.map((row) => ({
      sector: row.sector ?? 'General',
      count: row.count,
    }));
  }

  async listBuyersBySector(sector: string): Promise<User[]> {
    const normalizedSector = sector.trim();
    const isGeneral = normalizedSector.toLowerCase() === 'general';
    const baseFilter = {
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    };

    if (isGeneral) {
      return this.collection()
        .find({
          ...baseFilter,
          $or: [
            { sector: { $exists: false } },
            { sector: '' },
            { sector: { $regex: /^\s+$/ } },
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();
    }

    return this.collection()
      .find({
        ...baseFilter,
        sector: { $regex: new RegExp(`^${this.escapeRegExp(normalizedSector)}$`, 'i') },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findBuyerById(id: string): Promise<User | null> {
    return this.collection().findOne({
      id,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });
  }

  async findSupplierById(id: string): Promise<User | null> {
    return this.collection().findOne({
      id,
      role: UserRole.SUPPLIER,
      status: UserStatus.ACTIVE,
    });
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

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const result = await this.collection().updateOne(
      { id: userId },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      throw new NotFoundException('User not found');
    }
  }

  toSafeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private collection() {
    return this.databaseService.collection<User>('users');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
