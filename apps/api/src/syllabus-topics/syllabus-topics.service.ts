import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateSyllabusTopicDto, UpdateSyllabusTopicDto } from './dto';

@Injectable()
export class SyllabusTopicsService {
  private readonly logger = new Logger(SyllabusTopicsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByCourse(tenantId: string, courseId: string) {
    return this.prisma.syllabusTopic.findMany({
      where: { tenantId, courseId, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async create(
    tenantId: string,
    courseId: string,
    dto: CreateSyllabusTopicDto,
  ) {
    return this.prisma.syllabusTopic.create({
      data: {
        tenantId,
        courseId,
        title: dto.title,
        parentId: dto.parentId ?? null,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  async update(
    tenantId: string,
    courseId: string,
    id: string,
    dto: UpdateSyllabusTopicDto,
  ) {
    const topic = await this.prisma.syllabusTopic.findFirst({
      where: { id, tenantId, courseId, deletedAt: null },
    });
    if (!topic) throw new NotFoundException(`Syllabus topic ${id} not found.`);

    return this.prisma.syllabusTopic.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
      },
    });
  }

  async remove(tenantId: string, courseId: string, id: string) {
    const topic = await this.prisma.syllabusTopic.findFirst({
      where: { id, tenantId, courseId, deletedAt: null },
    });
    if (!topic) throw new NotFoundException(`Syllabus topic ${id} not found.`);

    // Soft-delete the topic and all children
    await this.prisma.syllabusTopic.updateMany({
      where: {
        OR: [{ id }, { parentId: id }],
        tenantId,
        courseId,
      },
      data: { deletedAt: new Date() },
    });
    return { message: 'Syllabus topic deleted.' };
  }
}
