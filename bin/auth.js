const axios = require('axios');
const qs = require('qs');
const CREDS = require('../config/creds');
const AzureTokensModel = require('../models/oauthtokens');

const { findAndUpdate } = require('./mongoops');
const { restAPICall } = require('./msgraph');

async function getLastestTokenFromDB(model) {
  const tokens = await model
    .find()
    .sort({ dateOfEntry: -1 })
    .limit(1);
  return tokens[0];
}

async function refreshtokens() {
  let tokenRefreshed = false;
  const lastestValidToken = await getLastestTokenFromDB(AzureTokensModel);
  if (!lastestValidToken) {
    console.log(
      'Not able to find any valid tokens in the database ... please try to login manually'
    );
  } else {
    const data = qs.stringify({
      client_id: CREDS.azure.client_id,
      scope: CREDS.azure.scope,
      redirect_uri: CREDS.azure.redirect_uri,
      grant_type: CREDS.azure.grant_type,
      client_secret: CREDS.azure.client_secret,
      refresh_token: lastestValidToken.token.refresh_token,
    });
    const axiosConfig = {
      method: 'post',
      url: CREDS.azure.token_endpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    };
    await axios(axiosConfig)
      .then(async function(response) {
        tokenRefreshed = true;
        try {
          await findAndUpdate(
            AzureTokensModel,
            { _id: lastestValidToken._id },
            { token: response.data }
          );
          console.log('Tokens refreshed sucessfully!');
        } catch {
          console.log('Not able to refresh tokens');
        }
      })
      .catch(function(error) {
        // console.log(error);
        console.log(
          `Error while trying to refresh token - Code: ${error.response.status} - Msg: ${error.response.statusText}`
        );
      });
  }
  return tokenRefreshed;
}

async function isTokenExpired() {
  return null;
}

async function getTokenObj(model) {
  const lastestTokenawait = getLastestTokenFromDB(model);
  // .then(console.log(`console foi...`))
  // .catch(console.log(`my bad`));
  return lastestTokenawait;
}

async function getValidTokenObj(model) {
  let objToken = await getLastestTokenFromDB(model);
  const tokenExpiredStatus = await isTokenExpired(objToken.token);
  if (!tokenExpiredStatus) {
    console.log('Token expired');
    console.log(`tentando refrescar tokens`);
    const result = await refreshtokens();
    // const result = false;
    if (result) {
      objToken = await getLastestTokenFromDB(model);
    } else {
      console.log(`Aborting - not able to refresh tokens`);
      process.exit(1);
    }
  }
  return objToken;
}

module.exports.refreshtokens = refreshtokens;
module.exports.getTokenObj = getTokenObj;
