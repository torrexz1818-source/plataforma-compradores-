import { User } from '../domain/user.model';
import { UserRole } from '../domain/user-role.enum';
import { UserStatus } from '../domain/user-status.enum';

export class UsersRepository {
  private readonly users: User[] = [
    {
      id: 'user-buyer-1',
      email: 'maria@empresa.com',
      passwordHash:
        '$2b$10$iuQDIpUnCqJTr0Q8r4lvBu9kGx7Nw8YfV5J6Mcw1W0QvG0K3vZbyy',
      fullName: 'Maria Garcia',
      company: 'TechCorp',
      position: 'Procurement Manager',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      points: 1250,
      createdAt: new Date('2024-01-15T00:00:00.000Z'),
      updatedAt: new Date('2024-01-15T00:00:00.000Z'),
    },
    {
      id: 'user-admin-1',
      email: 'carlos@supplyconnect.com',
      passwordHash:
        '$2b$10$iuQDIpUnCqJTr0Q8r4lvBu9kGx7Nw8YfV5J6Mcw1W0QvG0K3vZbyy',
      fullName: 'Carlos Mendez',
      company: 'SupplyConnect',
      position: 'Head of Education',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      points: 5400,
      createdAt: new Date('2023-06-01T00:00:00.000Z'),
      updatedAt: new Date('2023-06-01T00:00:00.000Z'),
    },
    {
      id: 'user-buyer-2',
      email: 'ana@globalinc.com',
      passwordHash:
        '$2b$10$iuQDIpUnCqJTr0Q8r4lvBu9kGx7Nw8YfV5J6Mcw1W0QvG0K3vZbyy',
      fullName: 'Ana Rodriguez',
      company: 'Global Inc.',
      position: 'Senior Buyer',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      points: 890,
      createdAt: new Date('2024-03-10T00:00:00.000Z'),
      updatedAt: new Date('2024-03-10T00:00:00.000Z'),
    },
    {
      id: 'user-buyer-3',
      email: 'roberto@indmex.com',
      passwordHash:
        '$2b$10$iuQDIpUnCqJTr0Q8r4lvBu9kGx7Nw8YfV5J6Mcw1W0QvG0K3vZbyy',
      fullName: 'Roberto Silva',
      company: 'Industrial MX',
      position: 'Procurement Director',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      points: 2100,
      createdAt: new Date('2023-11-20T00:00:00.000Z'),
      updatedAt: new Date('2023-11-20T00:00:00.000Z'),
    },
  ];

  create(user: User): User {
    this.users.push(user);
    return user;
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  list(): User[] {
    return [...this.users];
  }
}
