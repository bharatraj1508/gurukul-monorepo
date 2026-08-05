import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { PeriodTemplatesService } from './period-templates.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

const slot = (
  kind: string,
  startTime: string,
  endTime: string,
  periodNumber?: number,
) => ({ kind, startTime, endTime, periodNumber });

const validSlots = [
  slot('ASSEMBLY', '07:45', '08:00'),
  slot('PERIOD', '08:00', '08:45', 1),
  slot('BREAK', '08:45', '09:00'),
  slot('PERIOD', '09:00', '09:45', 2),
];

const existingTemplate = {
  id: 'tpl-1',
  tenantId: TENANT_ID,
  name: 'Regular Day',
  workingDays: [1, 2, 3, 4, 5],
  slots: [
    {
      sortOrder: 0,
      kind: 'PERIOD',
      periodNumber: 1,
      startTime: '08:00',
      endTime: '08:45',
      label: null,
    },
    {
      sortOrder: 1,
      kind: 'BREAK',
      periodNumber: null,
      startTime: '08:45',
      endTime: '09:00',
      label: 'Break',
    },
    {
      sortOrder: 2,
      kind: 'PERIOD',
      periodNumber: 2,
      startTime: '09:00',
      endTime: '09:45',
      label: null,
    },
  ],
};

describe('PeriodTemplatesService', () => {
  let service: PeriodTemplatesService;
  let prisma: {
    periodTemplate: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    periodTemplateSlot: { deleteMany: jest.Mock; createMany: jest.Mock };
    timetable: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      periodTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
        update: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
      },
      periodTemplateSlot: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      timetable: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodTemplatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PeriodTemplatesService);
  });

  describe('create — slot validation', () => {
    const create = (slots: any[]) =>
      service.create(TENANT_ID, USER_ID, {
        name: 'Regular',
        workingDays: [1, 2, 3],
        slots,
      });

    it('creates with index-based sortOrder and nulled periodNumber on breaks', async () => {
      await create(validSlots);

      expect(prisma.periodTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'Regular',
            workingDays: [1, 2, 3],
            createdBy: USER_ID,
            slots: {
              create: [
                expect.objectContaining({
                  sortOrder: 0,
                  kind: 'ASSEMBLY',
                  periodNumber: null,
                }),
                expect.objectContaining({
                  sortOrder: 1,
                  kind: 'PERIOD',
                  periodNumber: 1,
                }),
                expect.objectContaining({
                  sortOrder: 2,
                  kind: 'BREAK',
                  periodNumber: null,
                }),
                expect.objectContaining({
                  sortOrder: 3,
                  kind: 'PERIOD',
                  periodNumber: 2,
                }),
              ],
            },
          }),
        }),
      );
    });

    it('rejects a template without PERIOD slots', async () => {
      await expect(create([slot('BREAK', '08:00', '08:15')])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects startTime >= endTime', async () => {
      await expect(
        create([slot('PERIOD', '08:45', '08:00', 1)]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping slots', async () => {
      await expect(
        create([
          slot('PERIOD', '08:00', '08:45', 1),
          slot('PERIOD', '08:30', '09:15', 2),
        ]),
      ).rejects.toThrow(/overlaps/);
    });

    it('rejects non-contiguous period numbers', async () => {
      await expect(
        create([
          slot('PERIOD', '08:00', '08:45', 1),
          slot('PERIOD', '09:00', '09:45', 3),
        ]),
      ).rejects.toThrow(/contiguous/);
    });

    it('rejects a periodNumber on a BREAK slot', async () => {
      await expect(
        create([
          slot('PERIOD', '08:00', '08:45', 1),
          { ...slot('BREAK', '08:45', '09:00'), periodNumber: 2 },
        ]),
      ).rejects.toThrow(/only PERIOD slots/);
    });

    it('409s on a duplicate name', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce({ id: 'other' });
      await expect(create(validSlots)).rejects.toThrow(ConflictException);
    });
  });

  describe('update — structural edit guard', () => {
    it('blocks period-number changes while a non-ARCHIVED timetable uses it', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
      prisma.timetable.count.mockResolvedValueOnce(1);

      await expect(
        service.update(TENANT_ID, 'tpl-1', USER_ID, {
          slots: [slot('PERIOD', '08:00', '08:45', 1)], // drops period 2
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.timetable.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          periodTemplateId: 'tpl-1',
          status: { not: 'ARCHIVED' },
        }),
      });
    });

    it('blocks workingDays changes while referenced', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
      prisma.timetable.count.mockResolvedValueOnce(2);

      await expect(
        service.update(TENANT_ID, 'tpl-1', USER_ID, { workingDays: [1, 2, 3] }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows non-structural edits (times/labels) while referenced', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);

      await service.update(TENANT_ID, 'tpl-1', USER_ID, {
        slots: [
          slot('PERIOD', '08:10', '08:55', 1),
          slot('BREAK', '08:55', '09:10'),
          slot('PERIOD', '09:10', '09:55', 2),
        ],
      });

      // Same period numbers + working days — the reference check is skipped.
      expect(prisma.timetable.count).not.toHaveBeenCalled();
      expect(prisma.periodTemplateSlot.deleteMany).toHaveBeenCalled();
      expect(prisma.periodTemplateSlot.createMany).toHaveBeenCalled();
    });

    it('allows structural edits when only ARCHIVED timetables reference it', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
      prisma.timetable.count.mockResolvedValueOnce(0);

      await service.update(TENANT_ID, 'tpl-1', USER_ID, {
        workingDays: [1, 2, 3, 4, 5, 6],
      });

      expect(prisma.periodTemplate.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks deletion while a non-ARCHIVED timetable uses it', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);
      prisma.timetable.count.mockResolvedValueOnce(1);

      await expect(service.remove(TENANT_ID, 'tpl-1', USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('soft deletes when unreferenced', async () => {
      prisma.periodTemplate.findFirst.mockResolvedValueOnce(existingTemplate);

      await service.remove(TENANT_ID, 'tpl-1', USER_ID);

      expect(prisma.periodTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { deletedAt: expect.any(Date), updatedBy: USER_ID },
      });
    });
  });
});
