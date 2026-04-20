// Day 2 — Seed Script
// TODO: Implement the seed script
// Reference: Lesson 2.4 — Migration Systems with Prisma
//
// Requirements:
//   - Import PrismaClient and bcryptjs
//   - Create 2 users (admin + test user) using upsert (not create)
//   - Hash passwords with bcrypt (never store plaintext, even in seeds)
//   - Create 1 sample document for the test user
//   - Call prisma.$disconnect() on success and failure

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedRBAC() {
  // --- 1. Upsert all 9 permissions ---
  const permissionDefs = [
    { name: 'documents:create',      resource: 'documents',     action: 'create',  description: 'Upload documents' },
    { name: 'documents:read',        resource: 'documents',     action: 'read',    description: 'View documents' },
    { name: 'documents:update',      resource: 'documents',     action: 'update',  description: 'Edit document metadata' },
    { name: 'documents:delete',      resource: 'documents',     action: 'delete',  description: 'Delete documents' },
    { name: 'conversations:create',  resource: 'conversations', action: 'create',  description: 'Start conversations' },
    { name: 'conversations:read',    resource: 'conversations', action: 'read',    description: 'View conversations' },
    { name: 'users:read',            resource: 'users',         action: 'read',    description: 'View user list' },
    { name: 'users:manage',          resource: 'users',         action: 'manage',  description: 'Manage user accounts' },
    { name: 'roles:manage',          resource: 'roles',         action: 'manage',  description: 'Manage roles and permissions' },
  ];

  const permissions: Record<string, { id: string }> = {};
  for (const perm of permissionDefs) {
    permissions[perm.name] = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // --- 2. Upsert roles and map permissions ---
  const roleDefs = [
    {
      name: 'admin',
      description: 'Full system access',
      isDefault: false,
      permissions: Object.keys(permissions),
    },
    {
      name: 'member',
      description: 'Standard user',
      isDefault: true,
      permissions: [
        'documents:create', 'documents:read', 'documents:update',
        'conversations:create', 'conversations:read',
      ],
    },
    {
      name: 'viewer',
      description: 'Read-only access',
      isDefault: false,
      permissions: ['documents:read', 'conversations:read'],
    },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const roleDef of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isDefault: roleDef.isDefault,
      },
    });
    roles[roleDef.name] = role;

    for (const permName of roleDef.permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissions[permName].id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permissions[permName].id,
        },
      });
    }
  }

  console.log('RBAC seeded: 3 roles, 9 permissions');
  return roles;
}


async function main() {
  console.log('Seeding...');

  // Seed roles and permissions first
  const roles = await seedRBAC();

  // Admin user
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@docuchat.dev' },
    update: {},
    create: {
      email: 'admin@docuchat.dev',
      passwordHash: adminHash,
      tier: 'enterprise',
      tokenLimit: 1000000,
    },
  });

  // Assign admin role to admin user
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roles['admin'].id } },
    update: {},
    create: { userId: admin.id, roleId: roles['admin'].id },
  });

  // Regular test user
  const userHash = await bcrypt.hash('Test1234!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'test@docuchat.dev' },
    update: {},
    create: {
      email: 'test@docuchat.dev',
      passwordHash: userHash,
    },
  });

  // Assign member role to test user
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: roles['member'].id } },
    update: {},
    create: { userId: user.id, roleId: roles['member'].id },
  });

  // Sample document for the test user
  await prisma.document.create({
    data: {
      userId: user.id,
      title: 'Getting Started with DocuChat',
      filename: 'getting-started.txt',
      content: 'Welcome to DocuChat. This is a sample document.',
      status: 'ready',
      chunkCount: 1,
    },
  });

  console.log('Done. admin:', admin.email, '| user:', user.email);
}


main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });