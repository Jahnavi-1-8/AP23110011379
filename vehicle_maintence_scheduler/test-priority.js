const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3001/api/v1/notifications/priority');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

test();
