import { Injectable } from '@nestjs/common';
import { NeighborhoodDto } from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NeighborhoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<NeighborhoodDto[]> {
    const list = await this.prisma.neighborhood.findMany({
      orderBy: { code: 'asc' },
    });

    return list.map((n) => ({
      id: n.id,
      code: n.code,
      name: n.name,
      ward: n.ward,
      district: n.district,
      city: n.city,
      description: n.description,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));
  }

  async findById(id: string): Promise<NeighborhoodDto | null> {
    const n = await this.prisma.neighborhood.findUnique({
      where: { id },
    });
    if (!n) return null;
    return {
      id: n.id,
      code: n.code,
      name: n.name,
      ward: n.ward,
      district: n.district,
      city: n.city,
      description: n.description,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }
}
