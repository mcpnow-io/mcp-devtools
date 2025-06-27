# ServerActions Test Suite

This directory contains comprehensive test suites for the ServerActions class, organized by functionality.

## Test Files Structure

- **test-utils.ts** - Common mocks and utilities shared across test files
- **server-actions.config.test.ts** - Configuration management tests
- **server-actions.session.test.ts** - Session management tests  
- **server-actions.tools.test.ts** - Tools management tests
- **server-actions.communication.test.ts** - Communication functions tests

## Test Categories Covered

### ✅ Configuration Management
- Configuration loading and reloading
- Error handling for missing/corrupted config files
- State management across operations

### ✅ Session Management  
- Session listing and switching
- Auto-session selection logic
- Client information display
- Session state persistence

### ✅ Tools Management
- Tool listing, adding, and removal
- Tool configuration validation
- Complex parameter handling
- Error scenarios

### ✅ Communication Functions
- Ping functionality
- Sampling message sending
- Roots list requests
- Logging with different levels
- Change notifications

## Running Tests

### Run all ServerActions tests:
```bash
npm run test src/cli/actions/__test__/
```

### Run specific test files:
```bash
# Configuration tests
npm run test src/cli/actions/__test__/server-actions.config.test.ts

# Session management tests
npm run test src/cli/actions/__test__/server-actions.session.test.ts

# Tools management tests
npm run test src/cli/actions/__test__/server-actions.tools.test.ts

# Communication tests
npm run test src/cli/actions/__test__/server-actions.communication.test.ts
```

### Run tests with coverage:
```bash
npm run test -- --coverage src/cli/actions/__test__/
```

### Run tests in watch mode:
```bash
npm run test -- --watch src/cli/actions/__test__/
```

## Test Structure

Each test file follows this structure:
- **Setup**: Mock dependencies and create test environment
- **Arrange**: Set up test data and expectations
- **Act**: Execute the function being tested
- **Assert**: Verify the results and side effects

## Key Testing Patterns

### 1. Mock Management
- All dependencies are mocked using the utilities in `test-utils.ts`
- Mocks are reset between tests to ensure isolation
- Type-safe mocking with proper interfaces

### 2. Error Handling Tests
- Network failures
- Missing sessions
- Invalid configurations
- Malformed inputs

### 3. Edge Cases
- Empty inputs
- Null/undefined values
- Special characters
- Large datasets

### 4. State Verification
- Internal state changes
- Logger call verification
- Mock function call counts and arguments
- Side effect validation

## Issues Found During Testing

The white-box testing revealed several logical issues:

1. **Auto-session selection behavior** - May not match user expectations
2. **Type safety concerns** - Heavy use of `as any` type assertions
3. **Error handling inconsistency** - Repeated session check patterns
4. **Resource management** - Complex signal handling in interactive mode
5. **Configuration fallbacks** - Empty config on load failure may cause issues

## Future Test Additions

Additional test files that could be created:

- **server-actions.resources.test.ts** - Resource management tests
- **server-actions.prompts.test.ts** - Prompt management tests  
- **server-actions.interactive.test.ts** - Interactive mode tests
- **server-actions.edge-cases.test.ts** - Comprehensive edge case tests
- **server-actions.integration.test.ts** - End-to-end integration tests

## Test Metrics Target

- **Code Coverage**: 90%+ line coverage
- **Branch Coverage**: 85%+ branch coverage  
- **Function Coverage**: 100% function coverage
- **Test Count**: 50+ individual test cases

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Use descriptive test names that explain the scenario
3. Include both positive and negative test cases
4. Add comprehensive error handling tests
5. Update this README with new test categories 