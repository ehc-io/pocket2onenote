// process.env.NODE_CONFIG_DIR = `../config`;
process.env.SUPPRESS_NO_CONFIG_WARNING = true;
const config = require('config');
const dateFormat = require('date-fns/format');
const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');

const { connect2db, closedb } = require('./mongoops');
const { getValidToken } = require('./auth');

const { sendMSGraphAPIRequest } = require('./sharedfunctions');
// const { magentaBright } = require('chalk');

// load NoteBook from Creds
// if empty => goto create Notebook
// get list off all Notebooks
// iterate over NoteBooks name and find out if NoteBookname exists

async function getSectionIdEndpoint(dateString) {
  await connect2db(database);
  const tokenObj = await getValidToken(AzureTokensModel);
  const { notebookName } = CREDS.azure;
  const sectionName = dateFormat(new Date(dateString), 'yyyy-MM-dd-ww');
  let notebookId;
  let sectionId;
  let notebookCreateResp;
  let sectionCreateResp;
  let foundNotebook = false;
  let foundSection = false;
  const totalArticlesOnLastSection = 0;
  const currentNotebooks = await sendMSGraphAPIRequest(
    CREDS.azure.msGraphHost,
    CREDS.azure.notebookEndpoint,
    'GET',
    null,
    tokenObj.token.access_token
  );
  const currentSections = await sendMSGraphAPIRequest(
    CREDS.azure.msGraphHost,
    CREDS.azure.sectionsEndpoint,
    'GET',
    null,
    tokenObj.token.access_token
  );
  if (!currentNotebooks) {
    console.log(`not able to get current notebooks - aborting`);
    process.exit();
  }
  if (!currentSections) {
    console.log(`not able to get current sections - aborting`);
    process.exit();
  }
  // lists all Notebooks and compare displayName with Notebook name to be used - CREDS.azure.notebookName
  // if found store name and Id inside "notebookName" and  "notebookId" variables
  currentNotebooks.value.every(notebook => {
    if (notebook.displayName === notebookName) {
      notebookId = notebook.id;
      foundNotebook = true;
      console.log(`Found Notebook: ${notebookName} - id: ${notebookId}`);
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
    }
  }
  // lists all section names and compare sectionName with the value from getSectionName() function
  // if found populate variables sectionName and sectionId
  currentSections.value.every(section => {
    if (section.displayName === sectionName) {
      sectionId = section.id;
      foundSection = true;
      console.log(`Found Section: ${sectionName} - id: ${sectionId}`);
      return false;
    }
    return true;
  });
  // If the section isn't created already, this request creates a new one
  //

  if (!foundSection) {
    sectionCreateResp = await sendMSGraphAPIRequest(
      CREDS.azure.msGraphHost,
      [CREDS.azure.notebookEndpoint, notebookId, 'sections'].join('/'),
      'POST',
      JSON.stringify({ displayName: sectionName }),
      tokenObj.token.access_token
    );
    if (sectionCreateResp) {
      sectionId = sectionCreateResp.id;
    }
  }
  console.log(`Notebook to use: ${notebookName} - id: ${notebookId}`);
  console.log(`Section to use: ${sectionName} - id: ${sectionId}`);
  await closedb();
  return `https://${CREDS.azure.msGraphHost}${CREDS.azure.sectionsEndpoint}/${sectionId}/pages`;
}

async function main() {
  const dateString = '2021-01-17T14:28:37.527+00:00';
  const endpoint = await getSectionIdEndpoint(dateString);
  console.log(`the endpoint you should publish is: ${endpoint}`);
}

main();

module.exports.getSectionIdEndpoint = getSectionIdEndpoint;
