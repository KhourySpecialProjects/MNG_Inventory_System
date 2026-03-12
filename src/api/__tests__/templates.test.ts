import request from 'supertest';
import app from '../src/server';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock JWT verifier for protected routes
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(async () => ({
        sub: 'test-user-id',
        'cognito:username': 'testuser',
        email: 'test@example.com',
      })),
    })),
  },
}));

// Mock permissions check
jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async () => ({
    roleName: 'OWNER',
    permissions: [
      'template.create',
      'template.view',
      'template.update',
      'template.delete',
      'item.create',
    ],
  })),
  checkPermission: jest.fn(async () => ({ allowed: true })),
}));

// Mock S3 presigned URL generation
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example.com/presigned-url'),
}));

interface MockableCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function isCommandNamed(cmd: MockableCommand, name: string): boolean {
  return cmd.constructor.name === name;
}

let dynamoSendSpy: jest.SpyInstance;
let s3SendSpy: jest.SpyInstance;

beforeAll(() => {
  dynamoSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, 'send');
  s3SendSpy = jest.spyOn(S3Client.prototype, 'send');
});

afterAll(() => {
  dynamoSendSpy.mockRestore();
  s3SendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  s3SendSpy.mockResolvedValue({});
});

const validAuthCookie = 'auth_access=valid-token';

const mockTemplate = {
  PK: 'TEMPLATE#tmpl123',
  SK: 'METADATA',
  Type: 'Template',
  templateId: 'tmpl123',
  name: 'Test Template',
  description: 'A test template',
  status: 'draft',
  GSI1PK: 'ALL_TEMPLATES',
  GSI1SK: '2024-01-01T00:00:00.000Z',
  createdBy: 'test-user-id',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  updateLog: [],
};

const mockTemplateItem = {
  PK: 'TEMPLATE#tmpl123',
  SK: 'ITEM#titem456',
  Type: 'TemplateItem',
  templateId: 'tmpl123',
  templateItemId: 'titem456',
  name: 'Test Template Item',
  actualName: 'ITEM, TEST',
  description: 'A test item',
  isKit: false,
  parent: null,
  nsn: '1234-56-789-0123',
  liin: null,
  endItemNiin: null,
  imageKey: undefined,
  createdBy: 'test-user-id',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Templates Router', () => {
  // ---------------------------------------------------------------------------
  // createTemplate
  // ---------------------------------------------------------------------------
  describe('createTemplate', () => {
    it('creates a template successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } }; // getUserName
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'My Template',
          description: 'Template description',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        templateId: expect.any(String),
        template: expect.objectContaining({
          name: 'My Template',
          description: 'Template description',
          status: 'draft',
        }),
      });
    });

    it('creates a template with null description', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'No Desc Template',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.template?.description).toBeNull();
    });

    it('records create action in updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          const item = command.input.Item as Record<string, unknown>;
          const log = item.updateLog as Array<Record<string, unknown>>;
          expect(log).toHaveLength(1);
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            userName: 'Test User',
            action: 'create',
          });
          return {};
        }
        return {};
      });

      await request(app)
        .post('/trpc/createTemplate')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'test-user-id', name: 'Log Test' });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });

    it('rejects missing name (Zod validation)', async () => {
      const res = await request(app)
        .post('/trpc/createTemplate')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'test-user-id' });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplates
  // ---------------------------------------------------------------------------
  describe('getTemplates', () => {
    it('returns all templates', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockTemplate] };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplates')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        templates: expect.any(Array),
      });
      expect(res.body?.result?.data?.templates).toHaveLength(1);
    });

    it('returns empty array when no templates exist', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplates')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.templates).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplate
  // ---------------------------------------------------------------------------
  describe('getTemplate', () => {
    it('returns a single template', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockTemplate });

      const res = await request(app)
        .get('/trpc/getTemplate')
        .query({
          input: JSON.stringify({
            templateId: 'tmpl123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        template: expect.objectContaining({ templateId: 'tmpl123' }),
      });
    });

    it('returns error when template not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .get('/trpc/getTemplate')
        .query({
          input: JSON.stringify({
            templateId: 'nonexistent',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Template not found',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateTemplate
  // ---------------------------------------------------------------------------
  describe('updateTemplate', () => {
    it('updates template name and description', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {
            Attributes: {
              ...mockTemplate,
              name: 'Updated Name',
              description: 'Updated Desc',
            },
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Updated Name',
          description: 'Updated Desc',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        template: expect.objectContaining({ name: 'Updated Name' }),
      });
    });

    it('adds update entry to updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          const log = values[':log'] as Array<Record<string, unknown>>;
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            userName: 'Test User',
            action: 'update',
          });
          return { Attributes: mockTemplate };
        }
        return {};
      });

      await request(app)
        .post('/trpc/updateTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'New Name',
        });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTemplate
  // ---------------------------------------------------------------------------
  describe('deleteTemplate', () => {
    it('deletes template and its items', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockTemplate };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return {
            Items: [
              { PK: 'TEMPLATE#tmpl123', SK: 'ITEM#item1' },
              { PK: 'TEMPLATE#tmpl123', SK: 'ITEM#item2' },
            ],
          };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteTemplate')
        .set('Cookie', validAuthCookie)
        .send({ templateId: 'tmpl123', userId: 'test-user-id' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Template deleted successfully',
      });

      // Should delete 2 items + 1 metadata = 3 DeleteCommand calls
      const deleteCalls = dynamoSendSpy.mock.calls.filter(
        ([cmd]: [MockableCommand]) => isCommandNamed(cmd, 'DeleteCommand'),
      );
      expect(deleteCalls).toHaveLength(3);
    });

    it('returns error when template not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/deleteTemplate')
        .set('Cookie', validAuthCookie)
        .send({ templateId: 'nonexistent', userId: 'test-user-id' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Template not found',
      });
    });

    it('deletes template with no items', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockTemplate };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteTemplate')
        .set('Cookie', validAuthCookie)
        .send({ templateId: 'tmpl123', userId: 'test-user-id' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);

      // Only 1 DeleteCommand for the metadata itself
      const deleteCalls = dynamoSendSpy.mock.calls.filter(
        ([cmd]: [MockableCommand]) => isCommandNamed(cmd, 'DeleteCommand'),
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // addItemToTemplate
  // ---------------------------------------------------------------------------
  describe('addItemToTemplate', () => {
    it('adds item to template successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          // First call: template exists check, second call: getUserName
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/addItemToTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Added Item',
          actualName: 'ITEM, ADDED',
          nsn: '5555-55-555-5555',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        templateItemId: expect.any(String),
        templateItem: expect.objectContaining({ name: 'Added Item' }),
      });
    });

    it('returns 404 when template does not exist', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/addItemToTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'nonexistent',
          userId: 'test-user-id',
          name: 'Orphan Item',
        });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Template not found');
    });

    it('uploads image to S3 when provided', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const base64Image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const res = await request(app)
        .post('/trpc/addItemToTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Item With Image',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('adds kit item with kit-specific fields', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          const item = command.input.Item as Record<string, unknown>;
          expect(item.isKit).toBe(true);
          expect(item.liin).toBe('LIIN-001');
          expect(item.endItemNiin).toBe('NIIN-002');
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/addItemToTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Kit Template',
          isKit: true,
          liin: 'LIIN-001',
          endItemNiin: 'NIIN-002',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('logs add_item action in template updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          const log = values[':log'] as Array<Record<string, unknown>>;
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            action: 'add_item',
          });
          return {};
        }
        return {};
      });

      await request(app)
        .post('/trpc/addItemToTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Log Check Item',
        });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // createTemplateItem
  // ---------------------------------------------------------------------------
  describe('createTemplateItem', () => {
    it('creates a brand-new template item', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'New Template Item',
          actualName: 'ITEM, NEW',
          description: 'Brand new',
          nsn: '9999-99-999-9999',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        templateItemId: expect.any(String),
        templateItem: expect.objectContaining({
          name: 'New Template Item',
          actualName: 'ITEM, NEW',
          nsn: '9999-99-999-9999',
        }),
      });
    });

    it('returns 404 when template does not exist', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'nonexistent',
          userId: 'test-user-id',
          name: 'Orphan',
        });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Template not found');
    });

    it('uploads image to S3 when provided', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const base64Image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const res = await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Image Item',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('stores item with parent reference', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          const item = command.input.Item as Record<string, unknown>;
          expect(item.parent).toBe('parent-kit-id');
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Child Item',
          parent: 'parent-kit-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('logs create_item action in template updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplate, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          const log = values[':log'] as Array<Record<string, unknown>>;
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            action: 'create_item',
          });
          return {};
        }
        return {};
      });

      await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
          name: 'Log Test Item',
        });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });

    it('rejects missing name (Zod validation)', async () => {
      const res = await request(app)
        .post('/trpc/createTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTemplateItem
  // ---------------------------------------------------------------------------
  describe('updateTemplateItem', () => {
    it('updates template item fields', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          // First: existing item check, second: getUserName
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {
            Attributes: {
              ...mockTemplateItem,
              name: 'Updated Item',
              description: 'Updated desc',
            },
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
          name: 'Updated Item',
          description: 'Updated desc',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        templateItem: expect.objectContaining({ name: 'Updated Item' }),
      });
    });

    it('returns 404 when template item not found', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'nonexistent',
          userId: 'test-user-id',
          name: 'Ghost',
        });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Template item not found');
    });

    it('uploads new image when imageBase64 provided', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return { Attributes: mockTemplateItem };
        }
        return {};
      });

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const res = await request(app)
        .post('/trpc/updateTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('clears image when imageBase64 is null', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          // Check that imageKey is being set to null on the item update (first UpdateCommand)
          const expr = command.input.UpdateExpression as string;
          if (expr.includes('imageKey')) {
            const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
            expect(values[':imageKey']).toBeNull();
          }
          return { Attributes: { ...mockTemplateItem, imageKey: null } };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
          imageBase64: null,
        });

      expect(res.status).toBe(200);
      // S3 should NOT be called when clearing an image
      expect(s3SendSpy).not.toHaveBeenCalled();
    });

    it('logs update_item action in template updateLog', async () => {
      let updateCallCount = 0;
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          updateCallCount++;
          // The second UpdateCommand is the template metadata bump
          if (updateCallCount === 2) {
            const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
            const log = values[':log'] as Array<Record<string, unknown>>;
            expect(log[0]).toMatchObject({
              userId: 'test-user-id',
              action: 'update_item',
            });
          }
          return { Attributes: mockTemplateItem };
        }
        return {};
      });

      await request(app)
        .post('/trpc/updateTemplateItem')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
          name: 'Log Test',
        });

      expect(updateCallCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // removeItemFromTemplate
  // ---------------------------------------------------------------------------
  describe('removeItemFromTemplate', () => {
    it('removes item from template', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/removeItemFromTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Item removed from template',
      });
    });

    it('returns error when template item not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/removeItemFromTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'nonexistent',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Template item not found',
      });
    });

    it('logs remove_item action in template updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { ...mockTemplateItem, name: 'Test User' } };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          const log = values[':log'] as Array<Record<string, unknown>>;
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            action: 'remove_item',
          });
          return {};
        }
        return {};
      });

      await request(app)
        .post('/trpc/removeItemFromTemplate')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          templateItemId: 'titem456',
          userId: 'test-user-id',
        });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getTemplateItems
  // ---------------------------------------------------------------------------
  describe('getTemplateItems', () => {
    it('returns all items for a template', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockTemplateItem] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null }; // No parent
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplateItems')
        .query({
          input: JSON.stringify({
            templateId: 'tmpl123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        items: expect.any(Array),
      });
      expect(res.body?.result?.data?.items).toHaveLength(1);
    });

    it('returns empty array when template has no items', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplateItems')
        .query({
          input: JSON.stringify({
            templateId: 'tmpl123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.items).toEqual([]);
    });

    it('resolves parent name for child items', async () => {
      const childItem = { ...mockTemplateItem, parent: 'parent-kit-id' };

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [childItem] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Parent Kit Name' } };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplateItems')
        .query({
          input: JSON.stringify({
            templateId: 'tmpl123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      const items = res.body?.result?.data?.items;
      expect(items[0].parentName).toBe('Parent Kit Name');
    });

    it('includes presigned URL for items with images', async () => {
      const itemWithImage = {
        ...mockTemplateItem,
        imageKey: 'templates/tmpl123/image.png',
      };

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [itemWithImage] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTemplateItems')
        .query({
          input: JSON.stringify({
            templateId: 'tmpl123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      const items = res.body?.result?.data?.items;
      expect(items[0].imageLink).toBe('https://s3.example.com/presigned-url');
    });
  });

  // ---------------------------------------------------------------------------
  // importTemplateToTeam
  // ---------------------------------------------------------------------------
  describe('importTemplateToTeam', () => {
    const mockImportTemplateItem = {
      PK: 'TEMPLATE#tmpl123',
      SK: 'ITEM#ti-001',
      Type: 'TemplateItem',
      templateItemId: 'ti-001',
      templateId: 'tmpl123',
      name: 'Test Item',
      actualName: 'Actual Test Item',
      description: 'A template item',
      isKit: false,
      parent: null,
      nsn: '1234-56-789-0000',
      liin: '',
      endItemNiin: '',
      imageKey: undefined,
    };

    it('should import a single item to a team', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.SK === 'METADATA') {
          return { Item: { ...mockTemplate, templateId: 'tmpl123' } };
        }
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.PK?.startsWith('USER#')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockImportTemplateItem] };
        }
        if (isCommandNamed(command, 'BatchWriteCommand')) {
          return { UnprocessedItems: {} };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/importTemplateToTeam')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          teamId: 'team-001',
          userId: 'test-user-id',
          selections: [
            { templateItemId: 'ti-001', authQuantity: 1, serialNumber: 'SN-001' },
          ],
        });

      expect(res.status).toBe(200);
      const body = res.body?.result?.data;
      expect(body.success).toBe(true);
      expect(body.itemsCreated).toBe(1);
    });

    const mockKit = {
      PK: 'TEMPLATE#tmpl123',
      SK: 'ITEM#ti-kit-001',
      Type: 'TemplateItem',
      templateItemId: 'ti-kit-001',
      templateId: 'tmpl123',
      name: 'Test Kit',
      isKit: true,
      parent: null,
      nsn: '',
      liin: 'L001',
      endItemNiin: 'N001',
      imageKey: undefined,
    };

    const mockKitChild1 = {
      PK: 'TEMPLATE#tmpl123',
      SK: 'ITEM#ti-child-001',
      Type: 'TemplateItem',
      templateItemId: 'ti-child-001',
      templateId: 'tmpl123',
      name: 'Kit Child 1',
      isKit: false,
      parent: 'ti-kit-001',
      nsn: '1111-11-111-1111',
      liin: '',
      endItemNiin: '',
      imageKey: undefined,
    };

    const mockKitChild2 = {
      PK: 'TEMPLATE#tmpl123',
      SK: 'ITEM#ti-child-002',
      Type: 'TemplateItem',
      templateItemId: 'ti-child-002',
      templateId: 'tmpl123',
      name: 'Kit Child 2',
      isKit: false,
      parent: 'ti-kit-001',
      nsn: '2222-22-222-2222',
      liin: '',
      endItemNiin: '',
      imageKey: undefined,
    };

    it('should expand kit quantity and duplicate children per copy', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.SK === 'METADATA') {
          return { Item: { ...mockTemplate, templateId: 'tmpl123' } };
        }
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.PK?.startsWith('USER#')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockKit, mockKitChild1, mockKitChild2] };
        }
        if (isCommandNamed(command, 'BatchWriteCommand')) {
          return { UnprocessedItems: {} };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/importTemplateToTeam')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          teamId: 'team-001',
          userId: 'test-user-id',
          selections: [
            { templateItemId: 'ti-kit-001', authQuantity: 2, serialNumber: '' },
            { templateItemId: 'ti-child-001', authQuantity: 3, serialNumber: 'SN-A' },
            { templateItemId: 'ti-child-002', authQuantity: 4, serialNumber: 'SN-B' },
          ],
        });

      expect(res.status).toBe(200);
      const body = res.body?.result?.data;
      expect(body.success).toBe(true);
      // 2 kit copies + 2 children * 2 kit copies = 6 entities
      expect(body.itemsCreated).toBe(6);

      // Verify BatchWriteCommand was called with correct items
      const batchCalls = dynamoSendSpy.mock.calls.filter(
        ([cmd]: [MockableCommand]) => isCommandNamed(cmd, 'BatchWriteCommand'),
      );
      const allItems = batchCalls.flatMap(([cmd]: [MockableCommand]) => {
        const requestItems = (cmd.input as any).RequestItems;
        const tableName = Object.keys(requestItems)[0];
        return requestItems[tableName].map((r: any) => r.PutRequest.Item);
      });

      expect(allItems.length).toBe(6);
      const kits = allItems.filter((i: any) => i.isKit === true);
      expect(kits.length).toBe(2);
      // Each kit copy should have authQuantity 1 (not 2)
      kits.forEach((kit: any) => {
        expect(kit.authQuantity).toBe(1);
      });
      const children = allItems.filter((i: any) => i.isKit === false);
      expect(children.length).toBe(4);
      // Children should inherit liin and endItemNiin from kit
      children.forEach((child: any) => {
        expect(child.liin).toBe('L001');
        expect(child.endItemNiin).toBe('N001');
      });
    });

    it('should return error when template does not exist', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: undefined };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/importTemplateToTeam')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'nonexistent',
          teamId: 'team-001',
          userId: 'test-user-id',
          selections: [
            { templateItemId: 'ti-001', authQuantity: 1, serialNumber: 'SN-001' },
          ],
        });

      expect(res.status).toBe(404);
    });

    it('should return error when selection references non-existent template item', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.SK === 'METADATA') {
          return { Item: { ...mockTemplate, templateId: 'tmpl123' } };
        }
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.PK?.startsWith('USER#')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockImportTemplateItem] };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/importTemplateToTeam')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          teamId: 'team-001',
          userId: 'test-user-id',
          selections: [
            { templateItemId: 'nonexistent-id', authQuantity: 1, serialNumber: 'SN-001' },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should import kit child as standalone item when parent kit is not selected', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.SK === 'METADATA') {
          return { Item: { ...mockTemplate, templateId: 'tmpl123' } };
        }
        if (isCommandNamed(command, 'GetCommand') && (command.input as any).Key?.PK?.startsWith('USER#')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockKit, mockKitChild1] };
        }
        if (isCommandNamed(command, 'BatchWriteCommand')) {
          return { UnprocessedItems: {} };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/importTemplateToTeam')
        .set('Cookie', validAuthCookie)
        .send({
          templateId: 'tmpl123',
          teamId: 'team-001',
          userId: 'test-user-id',
          selections: [
            { templateItemId: 'ti-child-001', authQuantity: 1, serialNumber: 'SN-STANDALONE' },
          ],
        });

      expect(res.status).toBe(200);
      const body = res.body?.result?.data;
      expect(body.success).toBe(true);
      expect(body.itemsCreated).toBe(1);

      const batchCalls = dynamoSendSpy.mock.calls.filter(
        ([cmd]: [MockableCommand]) => isCommandNamed(cmd, 'BatchWriteCommand'),
      );
      const allItems = batchCalls.flatMap(([cmd]: [MockableCommand]) => {
        const requestItems = (cmd.input as any).RequestItems;
        const tableName = Object.keys(requestItems)[0];
        return requestItems[tableName].map((r: any) => r.PutRequest.Item);
      });

      expect(allItems[0].parent).toBeNull();
    });
  }); // end describe importTemplateToTeam

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('rejects requests without auth cookie', async () => {
      const res = await request(app)
        .get('/trpc/getTemplates')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) });

      expect(res.status).toBe(401);
    });
  });
});
