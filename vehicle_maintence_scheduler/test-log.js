const axios = require('axios');
const env = require('./src/config/env');

async function test() {
  console.log("Token length:", env.AUTH_TOKEN.length);
  try {
    const res = await axios.post('http://20.207.122.201/evaluation-service/logs', {
      stack: 'System',
      level: 'info',
      package: 'Legacy',
      message: 'Test message'
    }, {
      headers: { 'Authorization': `Bearer ${env.AUTH_TOKEN}` }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Failed:", err.response ? err.response.status : err.message);
    if (err.response) console.error(JSON.stringify(err.response.data));
  }
}

test();
