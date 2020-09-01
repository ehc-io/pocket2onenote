# Pocket2OneNote

Upload Mozilla Pocket Bookmarks to Microsoft OneNote  

Disclaimer:  The main purpose of this project was me trying to learn Nodejs and Puppeteer.  
Being that said, please have that in mind when reading my spaghetti code.

## Installation

Fill out **config/creds.js** and **config/default.json** with your data, use the examples files for that.
Most of the information inside those files is pretty stright-forward on how to get them. Although The API section is a bit tricky but those are explained latter on.

### Mongodb

This setup assumes you already have an existing Mongodb instance to store your posts before uploading those to MSOneNote. if you don't have ir, just run it from a docker instance on your machine using the script bellow:  

    docker run -p 27017:27017 -v <local-folder-to-store-your-data>:/data/db -d -e MONGO_INITDB_ROOT_USERNAME=mongoadmin -e MONGO_INITDB_ROOT_PASSWORD=SOME_PASSWORD mongo:latest

### OneNote API Authentication
  
First of all you need to register you app in the Azure POrtal, this is required for every app which consumes MSGraph APIs. Please follow the steps in the link below. When done you will obtain the **client_id** and **client_secret** values to fill in the config file (creds.js).

> <https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app>

> When asked for supported accounts, choose "Accounts in any organization directory (any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)".

Then we need to handle authentication for the OneNote API. This is achived by OAuth tokens we first acquire from a personal Microsoft Account. I've used the <https://github.com/ehc-io/msgraph-training-nodeexpressapp> repo as a portal for that, but you're welcome to come up with any other smarter ways.

if you decide to use this experimental portal, go to the demo/graph-tutorial folder and run the app from there (npm start). Once the portal is running, you run the login script from this repo (bin/login.js). Another puppeteer script will use the credentials on your config file for login in the portal automatically.

After authentication is completed, credential tokens are saved in mongodb (oauthtokens model), and automatically refreshed afterwards. So you should not need another portal authentication after that.

One Note Section ID (onenotesection) needs to be filled in the config/creds.js. It represents the ID of the OneNote section you're going to use to store the uploaded bookmarks. To store these data, I recommend you to create a new NoteBook, an a new section in OneNote using either one of the native or web apps. Then you use the endpoint bellow to query the MS Graph API and get a list of your sections. Indentify the one you've just created and get the ID field.

### MSGraph API endpoint: <https://graph.microsoft.com/v1.0/me/onenote/sections/>

    Sample output:

        {
            "id": "0-F76934BC1176D8A8!116", // THIS IS THE ID YOU'RE LOOKING FOR
            "self": "https://graph.microsoft.com/v1.0/users/user@outlook.com/onenote/sections/0-F76934BC1176D8A8!116",
            "createdDateTime": "2020-08-31T20:25:14.603Z",
            "displayName": "RawPocketNote", // NAME OF THE SECTION YOU'VE JUST CREATED
            "lastModifiedDateTime": "2020-08-31T20:29:25.093Z",
            "isDefault": false,
            "pagesUrl": "https://graph.microsoft.com/v1.0/users/user@outlook.com/onenote/sections/0-F76934BC1176D8A8!116/pages",
            "createdBy": {
                "user": {
                    "id": "F76934BC1176D8A8",
                    "displayName": "OneDrive user"
                }
        },

## Article Scraping and Uploading

There are 7 scripts under bin folder as follows

  **pagescraper.js** => run it first, it scrapes all the article pages and populates the db with the article urls it finds.
> [run this script everytime you have new articles]
  
  **articlescraper.js** => run this one for grabing the actual content, it scrapes each article individually and saves in the db. Be aware you may hit pocket rate limit eventually. The script will count consecutive errors and will exit automatically, Be smart and don't scrape that hard otherwise you're IP is going to be rate limited forever.
> [run this script everytime you have new articles]
  
  **uploader.js** => Finally when articles are populated into db, this get the data out to MS One Note.
> [run this script everytime you have new articles]

  **login.js** => use this to get the oauth tokens from you MS account.
> [only need to run this the first time you acquired Azure Oauth tokens]

  **refreshtokens.js** => refresh oauth tokens automatically so you don't have to re-login every time to MS OneNote for uploading data.
> [used internally no need to run it manually]

  **mongoops.js** => used internally for database operations
> [used internally no need to run it manually]

  **navigation.js** => use to login on pocket and scrape data. Be aware you might hit Google Captcha eventually, if you do so, you need to disable headless mode (headless: false), then increase LOGIN_WAIT_TIME variable on the .env file from 8 seconds to whatever is reasonable (60, 90, 120 seconds) and fill out the captcha challenge manually. After the first time you're IP will be white-listed and Captcha should go away, and you can get the values back to default (headless mode and wait time).  
  > [used internally no need to run it manually]  

I recommend you create a crontab job to run the first three scripts on a frequent basis.
>Run the scripts from the bin/ folder:

    bin/ node pagescraper.js
