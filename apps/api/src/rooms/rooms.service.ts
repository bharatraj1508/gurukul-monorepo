import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { ROOM_TYPE } from '../timetables/timetables.constants';
import { CreateRoomDto, UpdateRoomDto } from './dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateRoomDto) {
    await this.assertNameAvailable(tenantId, dto.name);

    try {
      return await this.prisma.room.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          type: dto.type ?? ROOM_TYPE.CLASSROOM,
          capacity: dto.capacity,
          createdBy: userId,
        },
      });
    } catch (err) {
      this.rethrowDuplicateName(err, dto.name);
    }
  }

  async findAll(tenantId: string, search?: string, type?: string) {
    return this.prisma.room.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!room) throw new NotFoundException(`Room ${id} not found.`);
    return room;
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateRoomDto,
  ) {
    const room = await this.findOne(tenantId, id);

    if (dto.name !== undefined && dto.name.trim() !== room.name) {
      await this.assertNameAvailable(tenantId, dto.name, id);
    }

    try {
      return await this.prisma.room.update({
        where: { id: room.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.capacity !== undefined && { capacity: dto.capacity }),
          updatedBy: userId,
        },
      });
    } catch (err) {
      this.rethrowDuplicateName(err, dto.name ?? room.name);
    }
  }

  async remove(tenantId: string, id: string, userId: string) {
    const room = await this.findOne(tenantId, id);

    await this.prisma.room.update({
      where: { id: room.id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Room deleted successfully.' };
  }

  private async assertNameAvailable(
    tenantId: string,
    name: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.room.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' as const },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `A room named "${name.trim()}" already exists.`,
      );
    }
  }

  /** Maps a raced unique-constraint hit on (tenantId, name) to a 409. */
  private rethrowDuplicateName(err: unknown, name: string): never {
    if ((err as { code?: string })?.code === 'P2002') {
      throw new ConflictException(
        `A room named "${name.trim()}" already exists.`,
      );
    }
    throw err;
  }
}
