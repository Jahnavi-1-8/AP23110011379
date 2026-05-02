const apiService = require('./src/services/apiService');

async function test() {
  try {
    const res = await apiService.fetchDepots();
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}

test();
