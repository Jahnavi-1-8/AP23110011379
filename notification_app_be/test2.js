const axios = require('axios');

async function test() {
  const url = 'http://20.207.122.201/evaluation-service/vehicles';
  
  const headersToTest = [
    { 'Authorization': 'Basic QkbpxH' },
    { 'Authorization': 'Basic ' + Buffer.from('QkbpxH:').toString('base64') },
    { 'Authorization': 'Basic ' + Buffer.from(':QkbpxH').toString('base64') }
  ];

  for (const headers of headersToTest) {
    try {
      console.log('Testing headers:', headers);
      const res = await axios.get(url, { headers });
      console.log('SUCCESS! Status:', res.status);
      console.log('Data:', Object.keys(res.data));
    } catch (e) {
      console.log('FAILED:', e.response ? e.response.status : e.message, e.response ? e.response.data : '');
    }
  }
}

test();
