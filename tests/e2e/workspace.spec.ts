import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

test.describe('Workspace and Data Workflows', () => {
  let userEmail: string;
  let userPassword = 'TestPassword123!';
  let userId: string;
  let companyId: string;

  test.beforeAll(async () => {
    // Seed an approved user for workspace tests
    const timestamp = Date.now();
    userEmail = `workspace.test.${timestamp}@example.com`;
    const company = await prisma.company.create({
      data: {
        legalName: `Workspace Test Co ${timestamp}`,
        tradeName: `Workspace Test Co ${timestamp}`,
        email: userEmail,
        defaultCurrency: 'AED'
      }
    });
    companyId = company.id;

    // Use a hardcoded hash for 'TestPassword123!' (or we can just register via API, which is cleaner)
  });

  test.beforeEach(async ({ request }) => {
    // Register and approve via API/DB
    const timestamp = Date.now();
    userEmail = `workspace.test.${timestamp}@example.com`;
    
    await request.post('/api/auth/register', {
      data: {
        fullName: 'Workspace Owner',
        email: userEmail,
        password: userPassword,
        companyName: `Workspace Corp ${timestamp}`,
        role: 'Quantity Surveyor',
        country: 'UAE',
        primaryIndustry: 'Construction',
        intendedUse: 'Testing',
        approximateVolume: '1-5',
        consent: true
      }
    });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user) {
      userId = user.id;
      companyId = user.companyId;
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true, emailVerifiedAt: new Date() }
      });
    }
  });

  test('should create a project, BOQ, and handle file uploads and generations', async ({ request }) => {
    // 1. Login
    const loginRes = await request.post('/api/auth/login', {
      data: { email: userEmail, password: userPassword }
    });
    expect(loginRes.ok()).toBeTruthy();

    const industry = await prisma.industryEngine.findFirst();
    const indId = industry?.id || (await prisma.industryEngine.create({ data: { name: 'Construction', key: 'construction', description: 'Construction', configJson: {} } })).id;

    // 2. Create Project
    const projectRes = await request.post('/api/projects', {
      data: {
        name: 'Test Tower E2E',
        description: 'E2E test project',
        clientName: 'Test Client',
        location: 'Dubai',
        industryId: indId,
        currency: 'AED'
      }
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectData = await projectRes.json();
    const projectId = projectData.data.id;
    expect(projectId).toBeDefined();

    // Verify DB Persistence
    const dbProject = await prisma.project.findUnique({ where: { id: projectId } });
    expect(dbProject).not.toBeNull();
    expect(dbProject?.name).toBe('Test Tower E2E');

    // 3. Create BOQ
    const boqRes = await request.post(`/api/projects/${projectId}/boqs`, {
      data: {
        title: 'Main Package',
        discipline: 'Architecture'
      }
    });
    // The route for creating BOQ might not be this exactly. We'll verify it.
    // Wait, the project creation already creates a default BOQ according to `createProjectWithDefaultBoq`!
    // So there is already a BOQ for this project. Let's find it.
    const boqs = await prisma.bOQ.findMany({ where: { projectId: projectId } });
    expect(boqs.length).toBeGreaterThan(0);
    const boqId = boqs[0].id;

    // 4. Seed BOQ data
    const section = await prisma.bOQSection.create({
      data: {
        boqId: boqId,
        title: 'General Requirements',
        order: 1
      }
    });

    await prisma.bOQItem.create({
      data: {
        boqId: boqId,
        sectionId: section.id,
        itemType: 'REGULAR',
        specification: 'Test Spec',
        quantity: 10,
        unit: 'm2',
        unitCost: 100,
        freightCost: 0,
        installationCost: 0,
        additionalCost: 0,
        marginPercentage: 10,
        marginMode: 'MARKUP',
        wastagePercentage: 0,
        taxApplicable: true,
        confidenceScore: 100,
        landedCost: 100,
        sellingRate: 110,
        totalAmount: 1100,
        status: 'APPROVED',
        category: 'Test Category',
        description: 'Test Description',
        itemCode: 'TEST-01',
        itemNumber: 1,
        order: 1
      }
    });

    // 5. Lock BOQ revision
    await prisma.bOQ.update({
      where: { id: boqId },
      data: { isLocked: true }
    });
    
    const boqRecordForSnapshot = await prisma.bOQ.findFirst({
      where: { id: boqId },
      include: {
        project: { include: { client: true, industryEngine: true } },
        sections: { include: { items: { include: { options: true } } } },
        verificationExceptions: { include: { boqItem: true } }
      }
    });

    // Also need a revision snapshot to allow generation
    await prisma.bOQRevisionSnapshot.create({
      data: {
        companyId: companyId,
        boqId: boqId,
        revisionNumber: boqs[0].revisionNumber,
        snapshotJson: boqRecordForSnapshot as any,
        createdByUserId: userId
      }
    });

    // 5.5 File Upload (PDF)
    const pdfPath = path.resolve(__dirname, 'fixtures/sample-text.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const uploadRes = await request.post(`/api/projects/${projectId}/files`, {
      multipart: {
        file: {
          name: 'sample-text.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      }
    });
    
    expect(uploadRes.ok()).toBeTruthy();
    const uploadData = await uploadRes.json();
    expect(uploadData.data).toBeDefined();
    const fileId = uploadData.data.id;
    
    const dbFile = await prisma.projectFile.findUnique({ where: { id: fileId } });
    expect(dbFile).not.toBeNull();

    // 6. Generate Document (XLSX)
    const template = await prisma.documentTemplate.findFirst({ where: { isActive: true } });
    const templateId = template?.id || (await prisma.documentTemplate.create({
      data: {
        companyId: companyId,
        name: 'Test Template',
        code: 'TEST_TMPL',
        type: 'CORPORATE_TECHNICAL',
        isActive: true,
      }
    })).id;

    const genRes = await request.post(`/api/projects/${projectId}/documents/generate`, {
      data: {
        boqId: boqId,
        templateId: templateId,
        documentType: 'XLSX',
        audience: 'INTERNAL'
      }
    });
    const genData = await genRes.json();
    if (!genRes.ok()) {
      console.log('Generation failed:', genData);
    }
    expect(genRes.ok()).toBeTruthy();
    const documentId = genData.data.id;
    expect(documentId).toBeDefined();

    // Verify DB Persistence
    const docDownloadRes = await request.get(`/api/projects/${projectId}/documents/downloads/${documentId}`);
    expect(docDownloadRes.ok()).toBeTruthy();
    const xlsxBuffer = await docDownloadRes.body();
    expect(xlsxBuffer.length).toBeGreaterThan(100); // Basic integrity check for an XLSX file
  });
});
