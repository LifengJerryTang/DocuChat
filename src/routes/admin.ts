import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { appEvents } from '../lib/events';
import { NotFoundError } from '../lib/errors';

const router = Router();

// All admin routes require authentication + roles:manage permission
router.use(authenticate);
router.use(requirePermission('roles:manage'));

// GET /api/v1/admin/roles — list all roles with their permissions and user counts
router.get('/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    res.json({
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isDefault: role.isDefault,
        userCount: role._count.users,
        permissions: role.permissions.map((rp) => rp.permission.name),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/admin/users/:userId/roles — assign a role to a user
router.post('/users/:userId/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const { roleName } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError(`Role '${roleName}' not found`);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: {
        userId,
        roleId: role.id,
        assignedBy: req.user!.id,
      },
    });

    appEvents.emit('admin:role-assigned', {
      targetUserId: userId,
      roleName,
      assignedBy: req.user!.id,
    });

    res.json({ success: true, data: { message: `Role '${roleName}' assigned to user` } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/admin/users/:userId/roles/:roleName — revoke a role from a user
router.delete('/users/:userId/roles/:roleName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const roleName = req.params.roleName as string;

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError('Role not found');

    await prisma.userRole.deleteMany({
      where: { userId, roleId: role.id },
    });

    appEvents.emit('admin:role-revoked', {
      targetUserId: userId,
      roleName,
      revokedBy: req.user!.id,
    });

    res.json({ success: true, data: { message: `Role '${roleName}' revoked` } });
  } catch (error) {
    next(error);
  }
});

export default router;
