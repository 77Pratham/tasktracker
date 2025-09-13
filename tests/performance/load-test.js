import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5000';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be below 10%
  },
};

// Test data
const testUser = {
  username: `testuser_${Math.random().toString(36).substr(2, 9)}`,
  email: `test_${Math.random().toString(36).substr(2, 9)}@example.com`,
  password: 'Test123!',
  firstName: 'Load',
  lastName: 'Test'
};

let authToken;

export function setup() {
  // Register a test user
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(testUser), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (registerRes.status === 201) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: testUser.email,
      password: testUser.password
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status === 200) {
      return { token: loginRes.json().data.token };
    }
  }

  return { token: null };
}

export default function(data) {
  if (!data.token) {
    console.log('No auth token available');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };

  // Test: Get tasks
  let response = http.get(`${BASE_URL}/api/tasks`, { headers });
  let success = check(response, {
    'Get tasks status is 200': (r) => r.status === 200,
    'Get tasks response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);

  sleep(1);

  // Test: Create task
  const taskData = {
    title: `Load Test Task ${Math.random()}`,
    description: 'This is a load test task',
    priority: 'medium',
    status: 'pending'
  };

  response = http.post(`${BASE_URL}/api/tasks`, JSON.stringify(taskData), { headers });
  success = check(response, {
    'Create task status is 201': (r) => r.status === 201,
    'Create task response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);

  if (response.status === 201) {
    const taskId = response.json().data._id;
    
    sleep(1);

    // Test: Update task
    const updateData = { status: 'in-progress' };
    response = http.put(`${BASE_URL}/api/tasks/${taskId}`, JSON.stringify(updateData), { headers });
    success = check(response, {
      'Update task status is 200': (r) => r.status === 200,
      'Update task response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!success);

    sleep(1);

    // Test: Get task stats
    response = http.get(`${BASE_URL}/api/tasks/stats`, { headers });
    success = check(response, {
      'Get stats status is 200': (r) => r.status === 200,
      'Get stats response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!success);
  }

  sleep(2);
}

export function teardown(data) {
  // Cleanup could be done here if needed
  console.log('Load test completed');
}
