import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { NeighborhoodDto } from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NeighborhoodsService implements OnModuleInit {
  private readonly logger = new Logger(NeighborhoodsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      await this.seedDefaultNeighborhoodsIfEmpty();
    }
  }

  async seedDefaultNeighborhoodsIfEmpty() {
    try {
      const count = await this.prisma.neighborhood.count();
      if (count === 0) {
        this.logger.log('Seeding initial neighborhood data...');
        await this.prisma.neighborhood.createMany({
          data: [
            {
              code: 'KP-01',
              name: 'Khu phố 1',
              ward: 'Phường Bến Nghé',
              district: 'Quận 1',
              city: 'TP. Hồ Chí Minh',
              description: 'Khu vực trung tâm hành chính và thương mại',
            },
            {
              code: 'KP-02',
              name: 'Khu phố 2',
              ward: 'Phường Bến Nghé',
              district: 'Quận 1',
              city: 'TP. Hồ Chí Minh',
              description: 'Khu dân cư hiện hữu và văn phòng',
            },
            {
              code: 'KP-03',
              name: 'Khu phố 3',
              ward: 'Phường Đa Kao',
              district: 'Quận 1',
              city: 'TP. Hồ Chí Minh',
              description: 'Khu dân cư truyền thống',
            },
          ],
        });
        this.logger.log('Initial neighborhoods seeded successfully.');
      }
    } catch {
      // ignore if DB is not connected or in test mock mode
    }
  }

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
