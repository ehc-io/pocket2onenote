process.env.NODE_CONFIG_DIR = `../config`;
const axios = require('axios');
const qs = require('qs');
const config = require('config');

const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');

const { connect2db, findAndUpdate, closedb } = require('./mongoops');

async function getLastTokenFromDB(model) {
  const tokens = await model
    .find()
    .sort({ dateOfEntry: -1 })
    .limit(1);
  return tokens;
}

// post query to oauth endpoint to refresh access token, then save to db
async function refreshtokens() {
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    const lastestValidToken = await getLastTokenFromDB(AzureTokensModel);
    if (lastestValidToken.length === 0) {
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
        url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data,
      };
      await axios(axiosConfig)
        .then(async function(response) {
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
          console.log(
            `Error while trying to refresh token - Code: ${error.response.status} - Msg: ${error.response.statusText}`
          );
        });
    }
  }
  closedb(database);
}

refreshtokens();

// module.exports = refreshtokens;
module.exports.getLastTokenFromDB = getLastTokenFromDB;
