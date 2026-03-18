/**
 * PRISMA DATABASE CLIENT
 *
 * This file initializes the Prisma client used for interacting with PostgreSQL.
 * It uses the 'prisma-adapter-pg' to handle connections via a standard connection string.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// The connection string contains DB host, user, password, and port
const connectionString = `${process.env.DATABASE_URL}`;

// Create an adapter to bridge Prisma's runtime with the PostgreSQL driver
const adapter = new PrismaPg({ connectionString });

// Setup a global singleton to prevent exhausting DB connections during Next.js hot-reloads
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
