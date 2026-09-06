const axios = require('axios');
async function test() {
  const { data } = await axios.post('http://localhost:3000/api/auth/login', {
    username: 'trabajo_social',
    password: '123456'
  });
  const cookie = data.accessToken ? Authentication= : '';
  const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api',
    headers: { Cookie: cookie }
  });
  
  // get expedientes
  const exps = await axiosInstance.get('/expedientes');
  const exp = exps.data[0];
  console.log('Referring exp', exp.id);
  
  // refer
  await axiosInstance.post(/expedientes//referir, {
    referencias: [ { area: 'MEDICA', motivo: 'Test' } ]
  });
  
  console.log('Success API call');
}
test().catch(console.error);
