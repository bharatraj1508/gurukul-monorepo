import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { Prisma, Tenant } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { PrismaService } from 'nestjs-prisma';

import { DEFAULT_ROLES } from '@repo/permissions';

import { Tokens } from '../users/types';
import { UsersService } from '../users/users.service';
import {
  CreateTenantDto,
  TenantSettingsResponseDto,
  UpdateTenantDto,
  UpdateTenantThemeDto,
} from './dto';
import {
  RESERVED_SUBDOMAINS,
  SUBDOMAIN_REGEX,
  TENANT_CACHE_TTL,
} from './tenants.constants';

/** Shape of the theme stored under Tenant.settings.theme. */
export interface StoredTheme {
  preset: string;
  radius: number;
  font: string;
  size: string;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  validateSubdomainFormat(subdomain: string): boolean {
    return SUBDOMAIN_REGEX.test(subdomain);
  }

  isReservedSubdomain(subdomain: string): boolean {
    return RESERVED_SUBDOMAINS.has(subdomain);
  }

  /**
   * Resolves a subdomain to an active Tenant. Returns null for invalid format,
   * reserved subdomains, unknown subdomains, and soft-deleted tenants. Callers
   * that require a tenant must enforce it themselves (e.g. via TenantGuard).
   */
  async resolveTenant(subdomain: string): Promise<Tenant | null> {
    if (!this.validateSubdomainFormat(subdomain)) return null;
    if (this.isReservedSubdomain(subdomain)) return null;

    const cacheKey = this.cacheKey(subdomain);
    const cached = await this.cacheManager.get<Tenant>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findFirst({
      where: { subdomain, deletedAt: null },
    });
    if (!tenant) return null;

    await this.cacheManager.set(cacheKey, tenant, TENANT_CACHE_TTL);
    return tenant;
  }

  async invalidateTenantCache(subdomain: string): Promise<void> {
    await this.cacheManager.del(this.cacheKey(subdomain));
  }

  /**
   * Creates a new tenant. The authenticated user becomes the tenant owner.
   */
  async createTenant(
    dto: CreateTenantDto,
    currentUserId: string,
  ): Promise<Tokens> {
    if (!this.validateSubdomainFormat(dto.subdomain)) {
      throw new BadRequestException(
        'Invalid subdomain. Use 3-63 lowercase letters, digits, or hyphens (not starting or ending with a hyphen).',
      );
    }
    if (this.isReservedSubdomain(dto.subdomain)) {
      throw new ConflictException('This subdomain is reserved.');
    }

    const existing = await this.prisma.tenant.findFirst({
      where: { subdomain: dto.subdomain, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This subdomain is already taken.');
    }

    const owner = await this.resolveAuthenticatedOwner(currentUserId);

    const { tenantId, membershipId, scopes, isAdmin } =
      await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            subdomain: dto.subdomain,
            name: dto.name,
            type: dto.type,
            settings: dto.theme
              ? ({
                  theme: this.toStoredTheme(dto.theme),
                } as unknown as Prisma.InputJsonObject)
              : {},
          },
        });
        const membership = await tx.tenantMembership.create({
          data: {
            tenantId: tenant.id,
            userId: owner.id,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });

        // Seed default roles with permissions from @repo/permissions
        let ownerRoleId: string | undefined;
        let ownerScopes: string[] = [];
        let ownerIsAdmin = false;

        for (const roleDef of DEFAULT_ROLES) {
          const role = await tx.role.create({
            data: {
              tenantId: tenant.id,
              name: roleDef.title,
              rank: roleDef.rank,
              isAdmin: roleDef.isAdmin,
              isSystemRole: true,
            },
          });

          // Seed role permissions
          if (roleDef.scopes.length > 0) {
            await tx.rolePermission.createMany({
              data: roleDef.scopes.map((scopeId) => ({
                roleId: role.id,
                permissionId: scopeId,
              })),
            });
          }

          // Track the Account Owner role to assign to the founding member
          if (roleDef.title === 'Account Owner') {
            ownerRoleId = role.id;
            ownerScopes = roleDef.scopes.map((s) => s as string);
            ownerIsAdmin = roleDef.isAdmin;
          }
        }

        // Assign Account Owner role to the founding member
        if (ownerRoleId) {
          await tx.membershipRole.create({
            data: {
              tenantMembershipId: membership.id,
              roleId: ownerRoleId,
              assignedById: owner.id,
            },
          });
        }

        return {
          tenantId: tenant.id,
          membershipId: membership.id,
          scopes: ownerScopes,
          isAdmin: ownerIsAdmin,
        };
      });

    return this.usersService.generateTokens(
      owner.id,
      owner.email,
      tenantId,
      membershipId,
      scopes,
      isAdmin,
    );
  }

  async getTenantSettings(
    tenantId: string,
  ): Promise<TenantSettingsResponseDto> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, subdomain: true, createdAt: true },
    });
    const memberCount = await this.prisma.tenantMembership.count({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
    });
    return { ...tenant, memberCount };
  }

  async updateTenant(
    tenantId: string,
    subdomain: string,
    actorUserId: string,
    dto: UpdateTenantDto,
  ): Promise<TenantSettingsResponseDto> {
    const oldTenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { name: dto.name },
    });
    await this.invalidateTenantCache(subdomain);

    this.logger.log(
      `Workspace renamed structure: ${JSON.stringify({
        action: 'RENAME_WORKSPACE',
        tenantId,
        actorUserId,
        oldName: oldTenant.name,
        newName: dto.name,
        timestamp: new Date().toISOString(),
      })}`,
    );

    return this.getTenantSettings(tenantId);
  }

  /** Returns the stored theme for a tenant, or null when none is set. */
  async getTenantTheme(tenantId: string): Promise<StoredTheme | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return this.extractTheme(tenant?.settings ?? null);
  }

  /** Merges the theme into Tenant.settings JSONB (owner-only, enforced upstream). */
  async updateTenantTheme(
    tenantId: string,
    subdomain: string,
    actorUserId: string,
    dto: UpdateTenantThemeDto,
  ): Promise<StoredTheme> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings: Prisma.JsonObject =
      tenant.settings &&
      typeof tenant.settings === 'object' &&
      !Array.isArray(tenant.settings)
        ? { ...tenant.settings }
        : {};

    const theme = this.toStoredTheme(dto);
    settings.theme = theme as unknown as Prisma.JsonValue;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: settings },
    });
    await this.invalidateTenantCache(subdomain);

    this.logger.log(
      `Workspace theme updated: ${JSON.stringify({
        action: 'UPDATE_WORKSPACE_THEME',
        tenantId,
        actorUserId,
        theme,
        timestamp: new Date().toISOString(),
      })}`,
    );

    return theme;
  }

  private toStoredTheme(dto: UpdateTenantThemeDto): StoredTheme {
    return {
      preset: dto.preset,
      radius: dto.radius,
      font: dto.font,
      size: dto.size,
    };
  }

  private extractTheme(settings: Prisma.JsonValue | null): StoredTheme | null {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return null;
    }
    const theme = settings.theme;
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
      return null;
    }
    const { preset, radius, font, size } = theme;
    if (
      typeof preset !== 'string' ||
      typeof radius !== 'number' ||
      typeof font !== 'string'
    ) {
      return null;
    }
    // `size` was added later; default it for themes stored before that.
    return {
      preset,
      radius,
      font,
      size: typeof size === 'string' ? size : 'md',
    };
  }

  private cacheKey(subdomain: string): string {
    return `tenant:${subdomain}`;
  }

  private async resolveAuthenticatedOwner(
    userId: string,
  ): Promise<{ id: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new BadRequestException('Authenticated user not found.');
    }
    return { id: user.id, email: user.email };
  }
}
