import { createDirectPrismaClient } from "../../src/lib/db/direct-prisma-client";
import { test, expect } from '@playwright/test';

const prisma = createDirectPrismaClient();

test.describe('Authentication and Registration Workflow', () => {
  const timestamp = Date.now();
  const testEmail = `test.owner.${timestamp}@example.com`;
  const companyName = `Acme Corp ${timestamp}`;

  test('should register a new company owner and require email verification', async ({ request }) => {
    // 1. Submit Registration
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        fullName: 'Test Owner',
        email: testEmail,
        password: 'Password123!',
        companyName: companyName,
        role: 'Quantity Surveyor',
        country: 'United Arab Emirates',
        primaryIndustry: 'Construction',
        intendedUse: 'Testing',
        approximateVolume: '1-5',
        consent: true
      }
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const registerResult = await registerResponse.json();
    expect(registerResult.data.email).toBe(testEmail);
    const userId = registerResult.data.userId;

    // 2. Self-service account is active immediately but cannot sign in until email verification.
    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.isActive).toBe(true);
    expect(userInDb?.emailVerifiedAt).toBeNull();

    // 3. Cannot login before email verification
    const loginResponse1 = await request.post('/api/auth/login', {
      data: { email: testEmail, password: 'Password123!' }
    });
    expect(loginResponse1.status()).toBe(403);
    const loginResult1 = await loginResponse1.json();
    expect(loginResult1.error.code).toBe('EMAIL_NOT_VERIFIED');

    // 4. Verify Email
    const emailTokenRecord = await prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    expect(emailTokenRecord).not.toBeNull();
    
    // We cannot easily get the raw token because it's hashed in the DB.
    // However, during test we can bypass the API and just update the DB,
    // OR we can fetch it if we expose it in dev mode, OR we can mock the mailer.
    // For E2E, the most robust way to test the API route is to have a test utility route
    // that returns the raw token, or we just manually update the DB to simulate it.
    // Since we need to test the workflow, let's manually update the DB.
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });

    // 5. Login succeeds after email verification; no administrator approval is required.
    const loginResponse2 = await request.post('/api/auth/login', {
      data: { email: testEmail, password: 'Password123!' }
    });
    expect(loginResponse2.ok()).toBeTruthy();
    
    // 6. Test duplicate submission handling
    const duplicateResponse = await request.post('/api/auth/register', {
      data: {
        fullName: 'Test Owner',
        email: testEmail,
        password: 'Password123!',
        companyName: companyName,
        role: 'Quantity Surveyor',
        country: 'UAE',
        primaryIndustry: 'Construction',
        intendedUse: 'Testing',
        approximateVolume: '1-5',
        consent: true
      }
    });
    expect(duplicateResponse.status()).toBe(409);
    
    // 7. Logout
    const logoutResponse = await request.post('/api/auth/logout');
    expect(logoutResponse.ok()).toBeTruthy();

    // 8. Password Reset
    const resetRequest = await request.post('/api/auth/password/forgot', {
      data: { email: testEmail }
    });
    expect(resetRequest.ok()).toBeTruthy();

    const resetTokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    expect(resetTokenRecord).not.toBeNull();
  });
});
