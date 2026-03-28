import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { UserStatus } from './domain/user-status.enum';
import { UsersService } from './users.service';

@Controller()
@UseGuards(AuthenticatedGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('buyer-sectors')
  async getBuyerSectors() {
    return this.usersService.getBuyerSectors();
  }

  @Get('buyers')
  async getBuyersBySector(@Query('sector') sector: string | undefined) {
    if (!sector?.trim()) {
      throw new BadRequestException('El parametro sector es obligatorio');
    }

    const buyers = await this.usersService.listBuyersBySector(sector);

    return buyers.map((buyer) => ({
      id: buyer.id,
      name: buyer.fullName,
      company: buyer.company,
      sector: buyer.sector ?? 'General',
      location: buyer.location ?? 'Sin ubicacion',
      description: buyer.description ?? 'Sin descripcion registrada.',
      isActiveBuyer: buyer.status === UserStatus.ACTIVE,
      createdAt: buyer.createdAt.toISOString(),
    }));
  }

  @Get('buyers/:id')
  async getBuyerById(@Param('id') id: string) {
    const buyer = await this.usersService.findBuyerById(id);

    if (!buyer) {
      throw new NotFoundException('Comprador no encontrado');
    }

    return {
      id: buyer.id,
      name: buyer.fullName,
      company: buyer.company,
      sector: buyer.sector ?? 'General',
      location: buyer.location ?? 'Sin ubicacion',
      description: buyer.description ?? 'Sin descripcion registrada.',
      email: buyer.email,
      phone: buyer.phone ?? '',
      createdAt: buyer.createdAt.toISOString(),
    };
  }
}
