// process.env.NODE_CONFIG_DIR = `../config`;
process.env.SUPPRESS_NO_CONFIG_WARNING = true;
const axios = require('axios');

const config = require('config');
const dateFormat = require('date-fns/format');
const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');
const ArticleModel = require('../models/pocketarticles');
const DBLogModel = require('../models/operations');

const bodyReplacer = new RegExp('/<h1>.+</h1>/');
const { getValidToken, refreshtokens } = require('./auth');
const { sendMSGraphAPIRequest } = require('./sharedfunctions');

// const getSectionIdEndpoint = require('./notesorganizer');

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

async function getSectionIdEndpoint() {
  const tokenObj = await getValidToken(AzureTokensModel);
  const { notebookName } = CREDS.azure;
  const { maxPagesperSection } = CREDS.azure;
  const newSectionName = dateFormat(
    new Date(Date.now()),
    "yyyy-MM-dd-hh-mm-aaaaa'm'"
  );
  let notebookId;
  let latestSectionId;
  let notebookCreateResp;
  let sectionCreateResp;
  let pagesForSectionQuery;
  let currentTotalPagesForSection;
  let createNewSection;
  let foundNotebook = false;
  const currentNotebooks = await sendMSGraphAPIRequest(
    CREDS.azure.msGraphHost,
    CREDS.azure.notebookEndpoint,
    'GET',
    null,
    tokenObj.token.access_token
  );
  if (!currentNotebooks) {
    console.log(`not able to get current notebooks - aborting`);
    process.exit(0);
  }
  // lists all Notebooks and compare displayName with Notebook name to be used - CREDS.azure.notebookName
  // if found store name and Id inside "notebookName" and  "notebookId" variables
  currentNotebooks.value.every(notebook => {
    if (notebook.displayName === notebookName) {
      notebookId = notebook.id;
      foundNotebook = true;
      // console.log(`Found Notebook: ${notebookName} - id: ${notebookId}`);
      return false;
    }
    return true;
  });
  // Detects if a new noteboook needs to be created - if positive populate notebookName and notebookId variables
  if (!foundNotebook) {
    notebookCreateResp = await sendMSGraphAPIRequest(
      CREDS.azure.msGraphHost,
      CREDS.azure.notebookEndpoint,
      'POST',
      JSON.stringify({ displayName: notebookName }),
      tokenObj.token.access_token
    );

    if (notebookCreateResp) {
      notebookId = notebookCreateResp.id;
      console.log(
        `New Notebook created: ${notebookName} - id ${notebookCreateResp.id}`
      );
    }
  }
  //
  // Get Current Sections
  const currentSections = await sendMSGraphAPIRequest(
    CREDS.azure.msGraphHost,
    `${CREDS.azure.notebookEndpoint}/${notebookId}/sections?$orderby=lastModifiedDateTime+desc`,
    'GET',
    null,
    tokenObj.token.access_token
  );
  if (!currentSections) {
    console.log(`not able to get current sections - aborting`);
    process.exit(0);
  }
  //
  // Get the latest stored section and its ammount of existing pages
  //
  if (currentSections.value.length > 0) {
    // Get ammount of pages on existing Section
    latestSectionId = currentSections.value[0].id;
    pagesForSectionQuery = await sendMSGraphAPIRequest(
      CREDS.azure.msGraphHost,
      [CREDS.azure.sectionsEndpoint, latestSectionId, 'pages?$count=true'].join(
        '/'
      ),
      'GET',
      null,
      tokenObj.token.access_token
    );
    currentTotalPagesForSection = parseInt(
      pagesForSectionQuery['@odata.count']
    );
  } else {
    currentTotalPagesForSection = 0;
    createNewSection = true;
  }
  //
  // If the section isn't created already or has #pages > maxPagesperSection
  //
  if (createNewSection || currentTotalPagesForSection >= maxPagesperSection) {
    sectionCreateResp = await sendMSGraphAPIRequest(
      CREDS.azure.msGraphHost,
      [CREDS.azure.notebookEndpoint, notebookId, 'sections'].join('/'),
      'POST',
      JSON.stringify({ displayName: newSectionName }),
      tokenObj.token.access_token
    );
    if (sectionCreateResp) {
      latestSectionId = sectionCreateResp.id;
      console.log(
        `New Section created: ${newSectionName} - id ${sectionCreateResp.id}`
      );
    }
  }

  return `https://${CREDS.azure.msGraphHost}${CREDS.azure.sectionsEndpoint}/${latestSectionId}/pages`;
}

async function uploadArticle(document, tokenObject) {
  const apiEndpoint = await getSectionIdEndpoint();
  // console.log(`API endpoint: ${apiEndpoint}`);
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
        `url: ${document.url} returned an error while submiting article to OneNote - Status code: ${error.response.status}`
      );
      // if (error.response.status >= 400) {
      //   process.exit(0);
      // }
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
  const { postWaitTime } = CREDS.azure;
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    const documents = await findDocs(
      ArticleModel,
      {
        sync: false,
        scraped: true,
      },
      { dateOfEntry: -1 }
    );
    console.log(`There are ${documents.length} articles to post`);
    for (const item of documents) {
      let postResult = false;
      const maxUploadTries = 2;
      let round = 0;
      const timeout = [Math.floor(Math.random() * postWaitTime)];
      while (round < maxUploadTries && !postResult) {
        const tokenObj = await getValidToken(AzureTokensModel);
        try {
          postResult = await uploadArticle(item, tokenObj);
        } catch {
          console.log(`not able to Post article: ${item.url}`);
        }
        round += 1;
      }
      await pause(timeout);
    }
    await closedb(database);
  }
}

main();
