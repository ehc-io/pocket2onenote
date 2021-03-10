// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const https = require('https');

// function stripaRight(s, charlist) {
//   return s.replace(new RegExp(`[${charlist}]+$`), '');
// }

function httpRequest(params, data) {
  return new Promise(function(resolve, reject) {
    const req = https.request(params, function(res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(
          // console.log(
          //   `Req: ${this.method} https://${this.res.client._host}${this.path} - Resp: HTTP request Rejected - statusCode=${res.statusCode}`
          // )
        );
      }
      // cumulate data
      let body = [];
      res.on('data', function(chunk) {
        body.push(chunk);
      });
      // resolve on end
      res.on('end', function() {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
        } catch (error) {
          reject(console.log(`error while parsing result ${error}`));
        }
        // console.log(
        //   `Req: ${res.req.method} ${res.req.protocol}://${res.req.host}${res.req.path}`
        // );
        // console.log(`Debug Req headers: ${JSON.stringify(res.req._headers)}`);
        // console.log(`Debug Resp Body: ${JSON.stringify(res.body)}`);
        // console.log(`Resp: Status : ${res.statusCode} ${res.statusMessage}`);
        resolve(body);
      });
      // reject on request error
      // req.on('error', function(error) {
      //   console.log(`Unkown error: ${error}`);
      //   reject(error);
      // });
    });
    if (data) {
      req.write(data);
    }
    // IMPORTANT
    req.end();
  });
}

function sendMSGraphAPIRequest(
  apiHostname,
  apiEndpoint,
  apiMethod,
  apiPayload,
  token
) {
  // console.log(apiHostname, apiEndpoint, apiMethod, apiPayload, token);
  const requestOptions = {
    hostname: apiHostname,
    port: 443,
    path: apiEndpoint,
    method: apiMethod,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
  const payload = apiPayload;
  const body = httpRequest(requestOptions, payload);
  return body;
}

module.exports.httpRequest = httpRequest;
module.exports.sendMSGraphAPIRequest = sendMSGraphAPIRequest;
// module.exports.stripaRight = stripaRight;
