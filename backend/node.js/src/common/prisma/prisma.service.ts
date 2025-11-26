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

    const databaseUrl = process.env.DATABASE_URL ?? '';

    // SQLite cleanup for in-memory/file-based tests
    if (databaseUrl.startsWith('file:')) {
      const tables = await this.$queryRaw<Array<{ name: string }>>`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%';
      `;

      if (!tables.length) {
        return;
      }

      await this.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
      for (const { name } of tables) {
        await this.$executeRawUnsafe(`DELETE FROM "${name}";`);
      }

      // Reset autoincrement sequences
      await this.$executeRawUnsafe('DELETE FROM sqlite_sequence;').catch(() => undefined);
      await this.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
      return;
    }

    // Default Postgres cleanup
    const tables = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('_prisma_migrations');
    `;

    if (!tables.length) {
      return;
    }

    const tableNames = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
  }
}
