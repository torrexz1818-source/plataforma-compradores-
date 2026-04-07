import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { UserRole } from './domain/user-role.enum';
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

  @Get('supplier-sectors')
  async getSupplierSectors() {
    return this.usersService.getSupplierSectors();
  }

  @Get('buyers')
  async getBuyersBySector(
    @Query('sector') sector: string | undefined,
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.SUPPLIER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo suppliers o admin pueden acceder a /buyers');
    }

    if (!sector?.trim()) {
      throw new BadRequestException('El parametro sector es obligatorio');
    }

    const buyers = await this.usersService.listBuyersBySector(sector);
    const hasAccess = await this.usersService.hasSensitiveAccess(user.sub);

    return buyers.map((buyer) => ({
      id: buyer.id,
      name: hasAccess ? buyer.fullName : this.usersService.maskField(buyer.fullName, 'name'),
      company: buyer.company,
      sector: buyer.sector ?? 'General',
      location: buyer.location ?? 'Sin ubicacion',
      description: buyer.description ?? 'Sin descripcion registrada.',
      email: hasAccess ? buyer.email : this.usersService.maskField(buyer.email, 'email'),
      phone: hasAccess ? (buyer.phone ?? '') : this.usersService.maskField(buyer.phone ?? '', 'phone'),
      ruc: hasAccess ? (buyer.ruc ?? '') : this.usersService.maskField(buyer.ruc ?? '', 'ruc'),
      isActiveBuyer: buyer.status === UserStatus.ACTIVE,
      createdAt: buyer.createdAt.toISOString(),
    }));
  }

  @Get('buyers/:id')
  async getBuyerById(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.SUPPLIER && user.role !== UserRole.ADMIN && user.sub !== id) {
      throw new ForbiddenException('No autorizado para ver este perfil');
    }

    const buyer = await this.usersService.findBuyerById(id);

    if (!buyer) {
      throw new NotFoundException('Comprador no encontrado');
    }

    if (user?.sub && user.role === UserRole.SUPPLIER) {
      await this.usersService.notifyProfileInteraction({
        viewerId: user.sub,
        viewerRole: UserRole.SUPPLIER,
        targetUserId: buyer.id,
        targetRole: UserRole.BUYER,
      });
    }

    const hasAccess = await this.usersService.hasSensitiveAccess(user.sub);
    const canSeeSensitive = user.role === UserRole.ADMIN || user.sub === id || hasAccess;

    return {
      id: buyer.id,
      name: canSeeSensitive ? buyer.fullName : this.usersService.maskField(buyer.fullName, 'name'),
      company: buyer.company,
      sector: buyer.sector ?? 'General',
      location: buyer.location ?? 'Sin ubicacion',
      description: buyer.description ?? 'Sin descripcion registrada.',
      email: canSeeSensitive ? buyer.email : this.usersService.maskField(buyer.email, 'email'),
      phone: canSeeSensitive ? (buyer.phone ?? '') : this.usersService.maskField(buyer.phone ?? '', 'phone'),
      createdAt: buyer.createdAt.toISOString(),
    };
  }

  @Get('suppliers')
  async getSuppliersBySector(
    @Query('sector') sector: string | undefined,
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo buyers o admin pueden acceder a /suppliers');
    }

    if (!sector?.trim()) {
      throw new BadRequestException('El parametro sector es obligatorio');
    }

    const suppliers = await this.usersService.listSuppliersBySector(sector);
    const hasAccess = await this.usersService.hasSensitiveAccess(user.sub);

    return suppliers.map((supplier) => {
      const parsedLocation = this.parseSupplierLocation(supplier.location);

      return {
        id: supplier.id,
        name: supplier.fullName,
        company: supplier.company,
        sector: supplier.sector ?? 'General',
        location: parsedLocation.locationLabel,
        coverage: parsedLocation.coverage,
        province: parsedLocation.province,
        district: parsedLocation.district,
        description: supplier.description ?? 'Sin descripcion registrada.',
        email: hasAccess ? supplier.email : this.usersService.maskField(supplier.email, 'email'),
        phone: hasAccess ? (supplier.phone ?? '') : this.usersService.maskField(supplier.phone ?? '', 'phone'),
        whatsapp: hasAccess ? (supplier.phone ?? '') : this.usersService.maskField(supplier.phone ?? '', 'phone'),
        isActiveSupplier: supplier.status === UserStatus.ACTIVE,
        createdAt: supplier.createdAt.toISOString(),
      };
    });
  }

  @Get('suppliers/recommended')
  async getRecommendedSuppliers(
    @Query('buyerId') buyerId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const targetBuyerId = (buyerId?.trim() || user.sub);
    if (targetBuyerId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No autorizado para ver recomendaciones de otro usuario');
    }

    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo compradores pueden ver recomendaciones');
    }

    return this.usersService.listRecommendedSuppliers(
      targetBuyerId,
      limit ? Number(limit) : 3,
    );
  }

  @Get('suppliers/:id')
  async getSupplierById(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN && user.sub !== id) {
      throw new ForbiddenException('No autorizado para ver este perfil');
    }

    const supplier = await this.usersService.findSupplierById(id);

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const parsedLocation = this.parseSupplierLocation(supplier.location);
    const reviews = await this.usersService.listSupplierReviews(supplier.id);
    const hasAccess = await this.usersService.hasSensitiveAccess(user.sub);
    const canSeeSensitive = user.role === UserRole.ADMIN || user.sub === id || hasAccess;

    if (user?.sub && user.role === UserRole.BUYER) {
      await this.usersService.notifyProfileInteraction({
        viewerId: user.sub,
        viewerRole: UserRole.BUYER,
        targetUserId: supplier.id,
        targetRole: UserRole.SUPPLIER,
      });
    }

    const hasContacted =
      user?.role === UserRole.BUYER && user.sub
        ? await this.usersService.hasBuyerContactedSupplier(user.sub, supplier.id)
        : false;
    const averageRating =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce((total, review) => total + review.rating, 0) /
              reviews.length
            ).toFixed(1),
          )
        : 0;

    return {
      id: supplier.id,
      name: supplier.fullName,
      company: supplier.company,
      sector: supplier.sector ?? 'General',
      location: parsedLocation.locationLabel,
      coverage: parsedLocation.coverage,
      province: parsedLocation.province,
      district: parsedLocation.district,
      description: supplier.description ?? 'Sin descripcion registrada.',
      reviewsCount: reviews.length,
      averageRating,
      hasContacted,
      email: canSeeSensitive ? supplier.email : this.usersService.maskField(supplier.email, 'email'),
      phone: canSeeSensitive ? (supplier.phone ?? '') : this.usersService.maskField(supplier.phone ?? '', 'phone'),
      createdAt: supplier.createdAt.toISOString(),
    };
  }

  @Get('suppliers/:id/reviews')
  async getSupplierReviews(@Param('id') id: string) {
    const supplier = await this.usersService.findSupplierById(id);

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const reviews = await this.usersService.listSupplierReviews(id);

    return {
      items: reviews,
    };
  }

  @Post('suppliers/:id/reviews')
  async createSupplierReview(
    @Param('id') supplierId: string,
    @Body() body: { rating?: number; comment?: string },
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.BUYER) {
      throw new ForbiddenException('Solo compradores pueden comentar proveedores');
    }

    const rating = Number(body.rating);
    const comment = body.comment?.trim() ?? '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('La calificacion debe estar entre 1 y 5');
    }

    if (!comment) {
      throw new BadRequestException('El comentario es obligatorio');
    }

    const review = await this.usersService.createOrUpdateSupplierReview({
      supplierId,
      buyerId: user.sub,
      rating,
      comment,
    });

    return { review };
  }

  private parseSupplierLocation(location?: string) {
    const raw = location?.trim() ?? '';
    const parts = raw
      .split('-')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (parts.length >= 3) {
      return {
        locationLabel: raw,
        coverage: parts[0],
        province: parts[1],
        district: parts.slice(2).join(' - '),
      };
    }

    return {
      locationLabel: raw || 'Sin ubicacion',
      coverage: parts[0] ?? 'Sin cobertura',
      province: 'Sin provincia',
      district: 'Sin distrito',
    };
  }
}
