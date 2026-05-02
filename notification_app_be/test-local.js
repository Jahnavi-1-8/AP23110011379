const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3001/api/v1/schedule/1');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
    if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

test();
