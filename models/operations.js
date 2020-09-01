const mongoose = require('mongoose');

const { Schema } = mongoose;

const DBLogSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  operationType: {
    type: String,
    required: true,
  },
  statusMsg: {
    type: String,
    required: true,
  },
  dateOfEntry: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('operationlogs', DBLogSchema);
