import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { TimetableSnapshotService } from './solver/timetable-snapshot.service';
import { TimetableSolverService } from './solver/timetable-solver.service';
import { TimetablesService } from './timetables.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

describe('TimetablesService', () => {
  let service: TimetablesService;
  let prisma: {
    timetable: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      aggregate: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    timetableSlot: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      count: jest.Mock;
    };
    timetableSubstitution: { findMany: jest.Mock };
    class: { count: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let snapshotService: { build: jest.Mock };
  let solverService: {
    enqueue: jest.Mock;
    reconcile: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      timetable: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _max: { version: null } }),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      timetableSlot: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      timetableSubstitution: { findMany: jest.fn().mockResolvedValue([]) },
      class: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction.mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
    );

    snapshotService = {
      build: jest.fn().mockResolvedValue({ payload: {}, issues: [] }),
    };
    solverService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      reconcile: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimetablesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TimetableSnapshotService, useValue: snapshotService },
        { provide: TimetableSolverService, useValue: solverService },
      ],
    }).compile();

    service = moduleRef.get(TimetablesService);
  });

  describe('findAll', () => {
    it('scopes to tenant and applies optional filters', async () => {
      await service.findAll(TENANT_ID, {
        academicTermId: 'term-1',
        status: 'PUBLISHED',
      });

      expect(prisma.timetable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            deletedAt: null,
            academicTermId: 'term-1',
            status: 'PUBLISHED',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404s for an unknown timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reconciles a GENERATING row before returning it', async () => {
      prisma.timetable.findFirst
        .mockResolvedValueOnce({
          id: 'tt-1',
          tenantId: TENANT_ID,
          status: 'GENERATING',
          jobId: 'job-1',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'tt-1',
          tenantId: TENANT_ID,
          status: 'DRAFT',
        });

      const result = await service.findOne(TENANT_ID, 'tt-1');

      expect(solverService.reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tt-1', jobId: 'job-1' }),
      );
      expect(result.status).toBe('DRAFT');
    });

    it('returns a settled row without reconciling', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'tt-1',
        status: 'DRAFT',
      });

      await service.findOne(TENANT_ID, 'tt-1');

      expect(solverService.reconcile).not.toHaveBeenCalled();
    });
  });

  describe('findSlots', () => {
    it('404s when the timetable is not owned', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(service.findSlots(TENANT_ID, 'tt-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps slot rows into the flat view shape', async () => {
      prisma.timetable.findFirst.mockResolvedValue({ id: 'tt-1' });
      prisma.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'slot-1',
          classId: 'class-1',
          class: { name: '10-A' },
          dayOfWeek: 1,
          periodNumber: 2,
          course: { id: 'c-1', name: 'Math' },
          teacher: {
            id: 'mem-1',
            user: { firstName: 'Ada', lastName: 'Lovelace' },
          },
          room: { id: 'r-1', name: 'Room 1', type: 'CLASSROOM' },
        },
      ]);

      const slots = await service.findSlots(TENANT_ID, 'tt-1');

      expect(slots[0]).toMatchObject({
        id: 'slot-1',
        className: '10-A',
        teacher: { membershipId: 'mem-1', name: 'Ada Lovelace' },
      });
    });
  });

  describe('preflight', () => {
    it('returns the snapshot issues', async () => {
      snapshotService.build.mockResolvedValue({
        payload: {},
        issues: [{ code: 'NO_ALLOCATIONS' }],
      });

      const result = await service.preflight(TENANT_ID, {
        academicTermId: 'term-1',
        periodTemplateId: 'tpl-1',
      } as any);

      expect(result).toEqual({ issues: [{ code: 'NO_ALLOCATIONS' }] });
    });
  });

  describe('generate', () => {
    const dto = {
      academicTermId: 'term-1',
      periodTemplateId: 'tpl-1',
    } as any;

    it('creates a GENERATING row at version max+1 and enqueues the job', async () => {
      prisma.timetable.aggregate.mockResolvedValue({ _max: { version: 4 } });
      prisma.timetable.create.mockResolvedValue({ id: 'tt-new' });
      prisma.timetable.update.mockResolvedValue({
        id: 'tt-new',
        inputSnapshot: { foo: 'bar' },
      });

      const result = await service.generate(TENANT_ID, USER_ID, dto);

      expect(prisma.timetable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            version: 5,
            status: 'GENERATING',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(solverService.enqueue).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ timetableId: 'tt-new', warnings: [] });
    });

    it('starts version at 1 when no prior versions exist', async () => {
      prisma.timetable.aggregate.mockResolvedValue({ _max: { version: null } });
      prisma.timetable.create.mockResolvedValue({ id: 'tt-new' });
      prisma.timetable.update.mockResolvedValue({
        id: 'tt-new',
        inputSnapshot: {},
      });

      await service.generate(TENANT_ID, USER_ID, dto);

      expect(prisma.timetable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 1 }),
        }),
      );
    });

    it('surfaces preflight ERRORs as 422 without enqueueing', async () => {
      snapshotService.build.mockResolvedValue({
        payload: {},
        issues: [
          { code: 'MISSING_INSTRUCTOR', severity: 'ERROR', message: 'x' },
          { code: 'AMBIGUOUS_INSTRUCTOR', severity: 'WARNING', message: 'y' },
        ],
      });

      await expect(service.generate(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.timetable.create).not.toHaveBeenCalled();
      expect(solverService.enqueue).not.toHaveBeenCalled();
    });

    it('marks the row FAILED and rethrows when enqueue fails', async () => {
      prisma.timetable.create.mockResolvedValue({ id: 'tt-new' });
      prisma.timetable.update.mockResolvedValue({
        id: 'tt-new',
        inputSnapshot: {},
      });
      solverService.enqueue.mockRejectedValue(new Error('redis down'));

      await expect(service.generate(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'redis down',
      );
      expect(prisma.timetable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tt-new', status: 'GENERATING' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('duplicate', () => {
    it('404s for an unknown source', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(
        service.duplicate(TENANT_ID, 'nope', USER_ID, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects duplicating a GENERATING timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'tt-1',
        status: 'GENERATING',
        slots: [],
      });

      await expect(
        service.duplicate(TENANT_ID, 'tt-1', USER_ID, {} as any),
      ).rejects.toThrow(ConflictException);
    });

    it('clones the source as a new DRAFT and copies slots', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'tt-1',
        status: 'PUBLISHED',
        academicTermId: 'term-1',
        periodTemplateId: 'tpl-1',
        name: 'Original',
        inputSnapshot: null,
        violations: null,
        solverStats: null,
        slots: [
          {
            classId: 'class-1',
            dayOfWeek: 1,
            periodNumber: 1,
            courseId: 'c-1',
            teacherMembershipId: 'mem-1',
            roomId: 'r-1',
          },
        ],
      });
      prisma.timetable.aggregate.mockResolvedValue({ _max: { version: 2 } });
      prisma.timetable.create.mockResolvedValue({ id: 'tt-copy' });

      await service.duplicate(TENANT_ID, 'tt-1', USER_ID, {} as any);

      expect(prisma.timetable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            version: 3,
            name: 'Original (copy)',
          }),
        }),
      );
      expect(prisma.timetableSlot.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              timetableId: 'tt-copy',
              classId: 'class-1',
            }),
          ],
        }),
      );
    });
  });

  describe('rename', () => {
    it('trims the name and stamps updatedBy', async () => {
      prisma.timetable.findFirst.mockResolvedValue({ id: 'tt-1' });
      prisma.timetable.update.mockResolvedValue({ id: 'tt-1' });

      await service.rename(TENANT_ID, 'tt-1', USER_ID, { name: '  New  ' });

      expect(prisma.timetable.update).toHaveBeenCalledWith({
        where: { id: 'tt-1' },
        data: { name: 'New', updatedBy: USER_ID },
      });
    });
  });

  describe('remove', () => {
    it('rejects deleting a PUBLISHED timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'tt-1',
        status: 'PUBLISHED',
      });

      await expect(service.remove(TENANT_ID, 'tt-1', USER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.timetable.update).not.toHaveBeenCalled();
    });

    it('soft deletes a DRAFT timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'tt-1',
        status: 'DRAFT',
      });

      await service.remove(TENANT_ID, 'tt-1', USER_ID);

      expect(prisma.timetable.update).toHaveBeenCalledWith({
        where: { id: 'tt-1' },
        data: { deletedAt: expect.any(Date), updatedBy: USER_ID },
      });
    });
  });

  describe('publish', () => {
    it('404s for an unknown target', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(service.publish(TENANT_ID, 'nope', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects publishing a non-DRAFT/ARCHIVED timetable', async () => {
      prisma.timetable.findFirst
        .mockResolvedValueOnce({ academicTermId: 'term-1' }) // ref
        .mockResolvedValueOnce({
          id: 'tt-1',
          status: 'GENERATING',
          academicTermId: 'term-1',
          periodTemplate: { slots: [], workingDays: [] },
        }); // target under lock

      await expect(service.publish(TENANT_ID, 'tt-1', USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('archives the current PUBLISHED and publishes the target', async () => {
      prisma.timetable.findFirst
        .mockResolvedValueOnce({ academicTermId: 'term-1' }) // ref
        .mockResolvedValueOnce({
          id: 'tt-1',
          status: 'DRAFT',
          academicTermId: 'term-1',
          periodTemplate: {
            workingDays: [1, 2, 3, 4, 5],
            slots: [{ kind: 'PERIOD' }, { kind: 'BREAK' }],
          },
        }) // target under lock
        .mockResolvedValueOnce({
          id: 'tt-old',
          name: 'Old',
          version: 1,
        }); // current published
      prisma.timetable.update
        .mockResolvedValueOnce({ id: 'tt-old' }) // archive current
        .mockResolvedValueOnce({ id: 'tt-1', status: 'PUBLISHED' }); // publish target
      prisma.class.count.mockResolvedValue(0);
      prisma.timetableSlot.count.mockResolvedValue(0);

      const result = await service.publish(TENANT_ID, 'tt-1', USER_ID);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.timetable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tt-old' },
          data: expect.objectContaining({ status: 'ARCHIVED' }),
        }),
      );
      expect(prisma.timetable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tt-1' },
          data: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
      expect(result.timetable.status).toBe('PUBLISHED');
    });

    it('warns about uncovered class cells', async () => {
      prisma.timetable.findFirst
        .mockResolvedValueOnce({ academicTermId: 'term-1' })
        .mockResolvedValueOnce({
          id: 'tt-1',
          status: 'ARCHIVED',
          academicTermId: 'term-1',
          periodTemplate: {
            workingDays: [1],
            slots: [{ kind: 'PERIOD' }, { kind: 'PERIOD' }],
          },
        })
        .mockResolvedValueOnce(null); // no current published
      prisma.timetable.update.mockResolvedValue({
        id: 'tt-1',
        status: 'PUBLISHED',
      });
      prisma.class.count.mockResolvedValue(2); // 2 classes * 1 day * 2 periods = 4 cells
      prisma.timetableSlot.count.mockResolvedValue(1); // only 1 placed -> 3 uncovered

      const result = await service.publish(TENANT_ID, 'tt-1', USER_ID);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'UNCOVERED_CELLS', count: 3 }),
        ]),
      );
    });
  });
});
