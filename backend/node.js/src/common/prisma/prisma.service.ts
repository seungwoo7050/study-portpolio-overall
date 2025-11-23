import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    // For testing purposes
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase should only be called in test environment');
    }

    const tables = await this.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';
    `;

    for (const { name } of tables) {
      await this.$executeRawUnsafe(`DELETE FROM "${name}";`);
    }
  }
}
