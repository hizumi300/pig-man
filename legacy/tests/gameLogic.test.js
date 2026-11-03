// tests/gameLogic.test.js
const { assignRoles, generateAllCards, calculateVictoryGoal } = require('../server/gameLogic');

describe('Game Logic Tests', () => {
    describe('assignRoles', () => {
        test('should assign correct roles for 5 players', () => {
            const roles = assignRoles(5);
            expect(roles).toHaveLength(5);
            
            const adventurers = roles.filter(role => role === 'adventurer').length;
            const guardians = roles.filter(role => role === 'guardian').length;
            
            expect(adventurers).toBe(3);
            expect(guardians).toBe(2);
        });

        test('should handle edge cases', () => {
            expect(() => assignRoles(2)).not.toThrow();
            expect(() => assignRoles(11)).not.toThrow();
            
            const roles = assignRoles(3);
            expect(roles).toHaveLength(3);
        });
    });

    describe('generateAllCards', () => {
        test('should generate correct card distribution', () => {
            const { cards, treasureCount, trapCount } = generateAllCards(5);
            
            expect(treasureCount).toBe(7);
            expect(trapCount).toBe(2);
            expect(cards).toHaveLength(25); // 7 + 2 + 16
            
            const treasures = cards.filter(card => card.type === 'treasure');
            const traps = cards.filter(card => card.type === 'trap');
            const empties = cards.filter(card => card.type === 'empty');
            
            expect(treasures).toHaveLength(7);
            expect(traps).toHaveLength(2);
            expect(empties).toHaveLength(16);
        });
    });

    describe('calculateVictoryGoal', () => {
        test('should return correct victory conditions', () => {
            const { treasureGoal, trapGoal } = calculateVictoryGoal(5);
            expect(treasureGoal).toBe(7);
            expect(trapGoal).toBe(2);
        });

        test('should handle 10 players correctly', () => {
            const { treasureGoal, trapGoal } = calculateVictoryGoal(10);
            expect(treasureGoal).toBe(10);
            expect(trapGoal).toBe(3);
        });
    });
});

// tests/socketHandlers.test.js
const Client = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { setupSocketHandlers } = require('../server/socketHandlers');

describe('Socket Handlers', () => {
    let httpServer, io, clientSocket;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer);
        setupSocketHandlers(io);
        
        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            
            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
        httpServer.close();
    });

    test('should create room successfully', (done) => {
        clientSocket.emit('createRoom', {
            playerName: 'TestPlayer',
            hasPassword: false,
            password: ''
        });

        clientSocket.on('roomCreated', (data) => {
            expect(data).toHaveProperty('roomId');
            expect(data).toHaveProperty('gameData');
            expect(data.gameData.players).toHaveLength(1);
            done();
        });
    });

    test('should handle invalid room creation', (done) => {
        clientSocket.emit('createRoom', {
            playerName: '', // Invalid name
            hasPassword: false,
            password: ''
        });

        clientSocket.on('error', (error) => {
            expect(error).toHaveProperty('message');
            done();
        });
    });
});

// package.json に追加するスクリプト
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "dev": "nodemon server/server.js",
    "start": "node server/server.js",
    "lint": "eslint server/ public/js/",
    "lint:fix": "eslint server/ public/js/ --fix"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "socket.io-client": "^4.6.1",
    "nodemon": "^2.0.22",
    "eslint": "^8.0.0"
  }
}

// .github/workflows/ci.yml (GitHub Actions)
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run lint
    - run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to production
      run: |
        # デプロイスクリプト
        echo "Deploying to production..."

// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    'public/js/**/*.js',
    '!server/server.js', // メインサーバーファイルは除外
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
