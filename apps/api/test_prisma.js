"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function test() { const result = await prisma.attendanceRecord.groupBy({ by: ['status'], _count: { _all: true } });  }
//# sourceMappingURL=test_prisma.js.map