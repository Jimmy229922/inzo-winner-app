const http = require('http');

const options = {
  hostname: 'localhost',
  port: 30001,
  path: '/api/tasks/today',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Calling /api/tasks/today endpoint...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
  process.exit(1);
});

req.end();
