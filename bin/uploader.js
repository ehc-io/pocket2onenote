process.env.NODE_CONFIG_DIR = `../config`;
const axios = require('axios');

const config = require('config');
const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');
const ArticleModel = require('../models/pocketarticles');
const DBLogModel = require('../models/operations');

const bodyReplacer = new RegExp('/<h1>.+</h1>/');
const apiEndpoint = `https://graph.microsoft.com/v1.0/me/onenote/sections/${CREDS.azure.onenotesection}/pages/`;
const { getLastTokenFromDB, refreshtokens } = require('./auth');
const {
  connect2db,
  findAndUpdate,
  closedb,
  save2db,
  findDocs,
} = require('./mongoops');

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
