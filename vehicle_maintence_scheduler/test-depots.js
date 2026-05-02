const axios = require('axios');
const env = require('./src/config/env');

async function test() {
  try {
    const res = await axios.get('http://20.207.122.201/evaluation-service/depots', {
      headers: { 'Authorization': `Bearer ${env.AUTH_TOKEN}` }
    });
    console.log(res.data.depots.map(d => d.ID));
  } catch (err) {
    console.error(err.message);
  }
}

test();
