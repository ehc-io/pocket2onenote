const qs = require('qs');
const addTime = require('date-fns/add');
const isAfter = require('date-fns/isAfter');

// const HttpsProxyAgent = require('https-proxy-agent');
const CREDS = require('../config/creds');
const AzureTokensModel = require('../models/oauthtokens');

const { findAndUpdate } = require('./mongoops');
const { httpRequest } = require('./sharedfunctions');

const proxy = 'http://localhost:3128';

async function getTokenObj(model) {
  const tokens = await model
    .find()
    .sort({ dateOfEntry: -1 })
    .limit(1);
  return tokens[0];
}

async function refreshtokens() {
  console.log(`Trying to Refresh OIDC tokens...`);
  // const agent = new HttpsProxyAgent(proxy);
  const storedToken = await getTokenObj(AzureTokensModel);
  console.log(`stored token id: ${storedToken._id}`);
  let body;
  if (!storedToken) {
    console.log(
      'Not able to find any valid tokens in the database ... please try to login manually'
    );
  } else {
    const payload = qs.stringify({
      client_id: CREDS.azure.client_id,
      scope: CREDS.azure.scope,
      redirect_uri: CREDS.azure.redirect_uri,
      grant_type: CREDS.azure.grant_type,
      client_secret: CREDS.azure.client_secret,
      refresh_token: storedToken.token.refresh_token,
    });
    const requestOptions = {
      host: CREDS.azure.tokenHostname,
      port: 443,
      path: CREDS.azure.tokenEndpoint,
      method: 'POST',
      agent: null,
      timeout: 10000,
      followRedirect: true,
      maxRedirects: 10,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '*/*',
        'Content-Length': payload.length,
        'Accept-Encoding': 'gzip, deflate',
      },
    };
    try {
      body = await httpRequest(requestOptions, payload);
    } catch (error) {
      console.log(`Failed while trying to refresh tokens: ${error}`);
      process.exit(1);
    }
    if (body) {
      try {
        await findAndUpdate(
          AzureTokensModel,
          { _id: storedToken._id },
          { $set: { token: body, dateOfEntry: Date.now() } }
        );
        console.log('Tokens refreshed sucessfully!');
      } catch (error) {
        console.log(`Error while trying to save refreshed tokens: ${error}`);
        process.exit(1);
      }
    }
  }
}

async function getValidToken(model) {
  let validToken;
  const storedToken = await getTokenObj(model);
  const tokenDate = new Date(storedToken.dateOfEntry);
  const tokenTTL = storedToken.token.expires_in;
  const dateOfTokenExpiration = new Date(
    addTime(tokenDate, { seconds: parseInt(tokenTTL) })
  );
  const isTokenExpired = isAfter(Date.now(), dateOfTokenExpiration);
  if (isTokenExpired) {
    console.log(
      `MSGraph Token created: ${tokenDate}, Expiration Date: ${dateOfTokenExpiration}.  Expired: ${isTokenExpired}`
    );
    console.log(`Stored token ID: ${storedToken._id} has expired`);
    await refreshtokens();
    validToken = await getTokenObj(AzureTokensModel);
    console.log(`New valid OAuth token: ${JSON.stringify(validToken.token)}`);
  } else {
    validToken = storedToken;
  }
  //
  return validToken;
}

module.exports.getValidToken = getValidToken;
