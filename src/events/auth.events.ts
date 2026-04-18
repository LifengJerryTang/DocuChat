import { appEvents } from '../lib/events';
import { prisma } from '../lib/prisma';

// Constants prevent typos — "auth:user-registerd" would silently never fire
export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth:user-registered',
  USER_LOGGED_IN:  'auth:user-logged-in',
  USER_LOGGED_OUT: 'auth:user-logged-out',
  TOKEN_REFRESHED: 'auth:token-refreshed',
  LOGIN_FAILED:    'auth:login-failed',
} as const;

// Listener 1: Log the signup for analytics
appEvents.on(AUTH_EVENTS.USER_REGISTERED, async (user) => {
  try {
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'signup',
        tokens: 0,
        costUsd: 0,
        metadata: JSON.stringify({
          email: user.email,
          tier: user.tier,
          registeredAt: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    // Log the failure but DON'T let it crash the main registration flow
    console.error('Failed to log signup:', error);
  }
});

// Listener 2: Create a welcome conversation
appEvents.on(AUTH_EVENTS.USER_REGISTERED, async (user) => {
  try {
    await prisma.conversation.create({
      data: {
        userId: user.id,
        title: 'Welcome to DocuChat',
      },
    });
  } catch (error) {
    console.error('Failed to create welcome conversation:', error);
  }
});

// Listener 3: Audit log for successful logins
appEvents.on(AUTH_EVENTS.USER_LOGGED_IN, async (data) => {
  try {
    await prisma.usageLog.create({
      data: {
        userId: data.userId,
        action: 'login',
        tokens: 0,
        costUsd: 0,
        metadata: JSON.stringify({
          deviceInfo: data.deviceInfo,
          loginAt: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error('Failed to log login:', error);
  }
});

// Listener 4: Track failed login attempts (useful for rate limiting later)
appEvents.on(AUTH_EVENTS.LOGIN_FAILED, async (data) => {
  try {
    console.warn(`Failed login for ${data.email} — reason: ${data.reason}`);
  } catch (error) {
    console.error('Failed to log failed login:', error);
  }
});
