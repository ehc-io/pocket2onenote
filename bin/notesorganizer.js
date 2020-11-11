// process.env.NODE_CONFIG_DIR = `../config`;
const axios = require('axios');
const qs = require('qs');
const config = require('config');
const CREDS = require('../config/creds');

const noteBookname = CREDS.azure.noteBookName;

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');

const { connect2db, closedb } = require('./mongoops');
const { getTokenObj } = require('./auth');
const { restAPICallAwait } = require('./msgraph');

// load NoteBook from Creds
// if empty => goto create Notebook
// get list off all Notebooks
// iterate over NoteBooks name and find out if NoteBookname exists

async function main() {
  await connect2db(database);
  const tokenObj = await getTokenObj(AzureTokensModel);
  const result = await restAPICallAwait(
    CREDS.azure.profile_endpoint,
    'GET',
    tokenObj.token
  )
    .then(console.log(`good!`))
    .catch(console.log(`baaad!!!!`));
  // console.log(`Token is ${result}`);
  await closedb();
}

main();
