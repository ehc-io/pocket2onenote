const mongoose = require('mongoose');

async function connect2db(database) {
  let status = false;
  await mongoose
    .connect(database, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false,
      useUnifiedTopology: true,
    })
    .then(() => {
      // console.log('MongoDB Connected');
      status = true;
    })
    .catch(err => {
      console.log(`Error while connecting to mongodb`);
      status = false;
    });
  // console.log(`Status: ${status}`);
  return status;
}

async function closedb(database) {
  mongoose.disconnect(database);
}

async function save2db(Model, data) {
  try {
    const newDocument = new Model(data);
    await newDocument.save();
  } catch (err) {
    console.log(`Error while saving on db: ${err}`);
  }
}

async function findDocs(model, query, sort) {
  const results = await model.find(query, null, { sort }, function(err, docs) {
    if (err) {
      console.log(`The query received an err: ${err}`);
      return null;
    }
    return docs;
  });
  // console.log(`Results: ${results}`);
  return results;
}

async function findAndUpdate(model, query, operation) {
  await model.findOneAndUpdate(
    query,
    operation,
    { new: true },
    (error, result) => {
      if (error) {
        console.log(`not able to update document: ${error}`);
      }
    }
  );
}

module.exports.connect2db = connect2db;
module.exports.closedb = closedb;
module.exports.save2db = save2db;
// module.exports.findDoc = findDoc;
module.exports.findDocs = findDocs;
module.exports.findAndUpdate = findAndUpdate;
