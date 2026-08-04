import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaModule } from 'nestjs-prisma';
import * as path from 'path';
import { Pool } from 'pg';

import { AcademicTermsModule } from './academic-terms/academic-terms.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClassesModule } from './classes/classes.module';
import { AtGuard } from './common/guards/at.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { CoursesModule } from './courses/courses.module';
import { EnrolmentsModule } from './enrolments/enrolments.module';
import { InstructorsModule } from './instructors/instructors.module';
import { MembersModule } from './members/members.module';
import { ParentsModule } from './parents/parents.module';
import { ProgramsModule } from './programs/programs.module';
import { RolesModule } from './roles/roles.module';
import { SavedFiltersModule } from './saved-filters/saved-filters.module';
import { NoticesModule } from './notices/notices.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '..', '..', '.env'),
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '..', '.env'),
        path.resolve(__dirname, '..', '..', '..', '..', '.env'),
      ],
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') ?? 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          // Keep finished jobs around briefly so the frontend can read results.
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error(
            'DATABASE_URL is not set. Add it to apps/api/.env (local dev) or the container environment (Docker).',
          );
        }
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        return {
          explicitConnect: true,
          prismaOptions: {
            adapter,
          },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    TenantsModule,
    RolesModule,
    MembersModule,
    AcademicTermsModule,
    StudentsModule,
    ProgramsModule,
    ClassesModule,
    InstructorsModule,
    CoursesModule,
    EnrolmentsModule,
    ParentsModule,
    TeachersModule,
    SavedFiltersModule,
    NoticesModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
