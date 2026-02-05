/**
 * Local development configuration
 *
 * This module contains configuration for local development mode.
 * When LOCAL_DEV is enabled, the application uses a local DynamoDB instance
 * running in Docker instead of AWS DynamoDB.
 */

export const isLocalDev = process.env.LOCAL_DEV === 'true';

// Mock user for local development
export const MOCK_USER = {
  sub: 'local-dev-user-001',
  email: 'dev@localhost',
  username: 'local-dev',
  name: 'Local Developer',
  role: 'Owner',
  accountId: 'local-account-001',
};

if (isLocalDev) {
  console.log('');
  console.log('='.repeat(60));
  console.log('🔧 LOCAL DEV MODE ENABLED');
  console.log('   - Auth: Bypassed (mock user)');
  console.log('   - Database: DynamoDB Local (Docker)');
  console.log('   - S3: Mock responses');
  console.log('   - Sign in with any email/password (min 10 chars)');
  console.log('');
  console.log('   💡 Run `npm run seed` to populate the database');
  console.log('='.repeat(60));
  console.log('');
}
