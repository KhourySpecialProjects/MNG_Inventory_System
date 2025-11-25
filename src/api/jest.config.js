module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/api/**/*.js',
    '!src/api/__tests__/**',
    '!src/api/jest.config.js'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/src/api/__tests__/setup/jest.setup.ts'],
  testTimeout: 10000
};