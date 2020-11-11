const axios = require('axios');
const { refreshtokens } = require('./auth');

async function restAPICallAwait(apiEnpoint, apiMethod, token, data = null) {
  const config = {
    method: apiMethod,
    url: apiEnpoint,
    headers: {
      'Content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data,
  };

  const r =  async (req) => { axios(config)
    .then(function(response) {
      console.log(JSON.stringify(response.data));
      return true;
    })
    .catch(function(error) {
      // console.log(error.response);
      console.log(
        `Request Failed: Status Code ${error.response.status} - ${error.response.statusText}`
      );
      console.log(`Refreshing Tokens...`);
      await refreshtokens();
      return true;
      });
    }
}

async function restAPICall(apiEnpoint, apiMethod, token, data = null) {
  const config = {
    method: apiMethod,
    url: apiEnpoint,
    headers: {
      'Content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data,
  };

  await axios(config)
    .then(function(response) {
      console.log(JSON.stringify(response.data));
      return true;
    })
    .catch(function(error) {
      console.log(error.response);
      console.log(
        `Request Failed: Status Code ${error.response.status} - ${error.response.statusText}`
      );
      return false;
    });
}
module.exports.restAPICallAwait = restAPICallAwait;
