process.env.NODE_CONFIG_DIR = `../config`;
const axios = require('axios');
const qs = require('qs');

const config = require('config');
const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');
const ArticleModel = require('../models/pocketarticles');
const DBLogModel = require('../models/operations');

const bodyReplacer = new RegExp('/<h1>.+</h1>/');
const apiEndpoint = `https://graph.microsoft.com/v1.0/me/onenote/sections/${CREDS.azure.onenotesection}/pages/`;

const {
  connect2db,
  findAndUpdate,
  closedb,
  save2db,
  findDocs,
} = require('./mongoops');

async function getLastTokenFromDB(model) {
  const tokens = await model
    .find()
    .sort({ dateOfEntry: -1 })
    .limit(1);
  return tokens[0];
}

async function refreshtokens() {
  const lastestValidToken = await getLastTokenFromDB(AzureTokensModel);
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
        console.log(error);
        console.log(
          `Error while trying to refresh token - Code: ${error.response.status} - Msg: ${error.response.statusText}`
        );
      });
  }
}

function gethashtags(tagList) {
  const hashTags = [];
  tagList.forEach(element => {
    hashTags.push(`#${element}`);
  });
  return hashTags;
}

async function uploadArticle(document, tokenObject) {
  let result = false;
  const payload = `
    <html lang="en-US">
    <head>
        <title>${document.title}</title>
    </head>
    <body>
        <a href=${document.url}>source</a>
        <p><p>
        ${gethashtags(document.tags).join(' ')}
        <p></p>
        ${document.body.replace(bodyReplacer, '')}
    </body>
    </html>`;
  const postConfig = {
    method: 'post',
    url: apiEndpoint,
    headers: {
      'Content-type': 'application/xhtml+xml',
      Authorization: `Bearer ${tokenObject.token.access_token}`,
    },
    data: payload,
  };
  await axios(postConfig)
    .then(async function() {
      await save2db(DBLogModel, {
        url: document.url,
        operationType: 'article post',
        statusMsg: 'sucessful',
      });
      console.log(`${document.url} uploaded sucessfully`);
      await findAndUpdate(ArticleModel, { url: document.url }, { sync: true });
      result = true;
    })
    .catch(async function(error) {
      console.log(
        `url: ${document.url} returned an error while submiting article to OneNote`
      );
      await save2db(DBLogModel, {
        url: document.url,
        operationType: 'article post',
        statusMsg: `API ERROR: ${error.message}`,
      });
      console.log('Refreshing access token...');
      await refreshtokens();
    });
  return result;
}

function pause(t) {
  return new Promise(function(resolve) {
    setTimeout(resolve, t);
  });
}

// Main function
async function main() {
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    const documents = await findDocs(ArticleModel, {
      sync: false,
      scraped: true,
    });
    for (const item of documents) {
      let postResult = false;
      // console.log(item.url);
      const maxUploadTries = 2;
      let round = 0;
      const timeout = [Math.floor(Math.random() * 5000)];
      while (round < maxUploadTries && !postResult) {
        const lastValidToken = await getLastTokenFromDB(AzureTokensModel);
        postResult = await uploadArticle(item, lastValidToken);
        round += 1;
      }
      await pause(timeout);
    }
    await closedb(database);
  }
}

main();
