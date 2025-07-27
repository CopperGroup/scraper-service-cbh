// jest.config.js
module.exports = {
    testEnvironment: 'node',
    clearMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    moduleFileExtensions: ['js', 'json', 'node'],
    moduleDirectories: ['node_modules', 'src'], // This tells Jest to look in 'src' as a root for imports
    fakeTimers: {
      enableGlobally: true, // Enable fake timers globally for all tests
    },
  };