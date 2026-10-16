import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { UserRole } from "@prisma/client";

type AuditRow = {
  id: string;
  event: string;
  entityId: string;
  userId: string;
  username: string;
  displayName: string;
  createdAt: Date;
};

const PAGE_SIZE = 30;

@Controller("audit")
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list(@Query("page") rawPage = "1", @Query("search") rawSearch = "") {
    const page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) {
      throw new BadRequestException("Invalid page number");
    }
    if (rawSearch.length > 150) {
      throw new BadRequestException("Search can have at most 150 characters");
    }

    // SQL parameters protect against injection. % and * are wildcard-any-sequence;
    // _ and ? are wildcard-single-character. Backslash is escaped literally.
    const pattern = `%${rawSearch.trim().replace(/\\/g, "\\\\").replace(/\*/g, "%").replace(/\?/g, "_")}%`;
    const offset = (page - 1) * PAGE_SIZE;

    const [rows, counts] = await this.db.$transaction([
      this.db.$queryRaw<AuditRow[]>`
        SELECT a.id, a.event, a."entityId", a."userId",
               u.username, u."displayName",
               a."createdAt"
        FROM "AuditLog" a
        JOIN "User" u ON u.id = a."userId"
        WHERE a.id ILIKE ${pattern}
           OR a.event ILIKE ${pattern}
           OR a."entityId" ILIKE ${pattern}
           OR a."userId" ILIKE ${pattern}
           OR u.username ILIKE ${pattern}
           OR u."displayName" ILIKE ${pattern}
           OR a."createdAt"::text ILIKE ${pattern}
           OR to_char(a."createdAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') ILIKE ${pattern}
        ORDER BY a."createdAt" DESC, a.id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      this.db.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*)::bigint AS total
        FROM "AuditLog" a
        JOIN "User" u ON u.id = a."userId"
        WHERE a.id ILIKE ${pattern}
           OR a.event ILIKE ${pattern}
           OR a."entityId" ILIKE ${pattern}
           OR a."userId" ILIKE ${pattern}
           OR u.username ILIKE ${pattern}
           OR u."displayName" ILIKE ${pattern}
           OR a."createdAt"::text ILIKE ${pattern}
           OR to_char(a."createdAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') ILIKE ${pattern}
      `,
    ]);

    const total = Number(counts[0]?.total ?? 0);
    return { rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }
}
