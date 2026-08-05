import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { RoomsService } from './rooms.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: {
    room: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      room: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RoomsService);
  });

  describe('create', () => {
    it('creates a room with defaults and audit fields', async () => {
      prisma.room.create.mockResolvedValue({ id: 'room-1' });

      await service.create(TENANT_ID, USER_ID, {
        name: ' Physics Lab ',
        capacity: 30,
      });

      expect(prisma.room.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          name: 'Physics Lab',
          type: 'CLASSROOM',
          capacity: 30,
          createdBy: USER_ID,
        },
      });
    });

    it('409s on a duplicate name', async () => {
      prisma.room.findFirst.mockResolvedValueOnce({ id: 'room-9' });

      await expect(
        service.create(TENANT_ID, USER_ID, { name: 'Lab', capacity: 10 }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.room.create).not.toHaveBeenCalled();
    });

    it('maps a raced P2002 to 409', async () => {
      prisma.room.create.mockRejectedValueOnce({ code: 'P2002' });

      await expect(
        service.create(TENANT_ID, USER_ID, { name: 'Lab', capacity: 10 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('filters by tenant, search, and type', async () => {
      await service.findAll(TENANT_ID, 'lab', 'SCIENCE_LAB');

      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          deletedAt: null,
          name: { contains: 'lab', mode: 'insensitive' },
          type: 'SCIENCE_LAB',
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('404s for an unknown room', async () => {
      await expect(service.findOne(TENANT_ID, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('409s when renaming onto an existing name', async () => {
      prisma.room.findFirst
        .mockResolvedValueOnce({ id: 'room-1', name: 'Old' }) // findOne
        .mockResolvedValueOnce({ id: 'room-2' }); // duplicate probe

      await expect(
        service.update(TENANT_ID, 'room-1', USER_ID, { name: 'Taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates fields and stamps updatedBy', async () => {
      prisma.room.findFirst.mockResolvedValueOnce({
        id: 'room-1',
        name: 'Old',
      });
      prisma.room.update.mockResolvedValue({ id: 'room-1' });

      await service.update(TENANT_ID, 'room-1', USER_ID, { capacity: 45 });

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { capacity: 45, updatedBy: USER_ID },
      });
    });
  });

  describe('remove', () => {
    it('soft deletes', async () => {
      prisma.room.findFirst.mockResolvedValueOnce({
        id: 'room-1',
        name: 'Lab',
      });

      await service.remove(TENANT_ID, 'room-1', USER_ID);

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { deletedAt: expect.any(Date), updatedBy: USER_ID },
      });
    });
  });
});
