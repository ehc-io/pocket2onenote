const mongoose = require('mongoose');

const { Schema } = mongoose;

const OAuthTokenSchema = new Schema({
  config: {
    type: Schema.Types.Mixed,
  },
  client: {
    type: Schema.Types.Mixed,
  },
  token: {
    type: Schema.Types.Mixed,
  },
  dateOfEntry: {
    type: Date,
    index: true,
    default: Date.now(),
  },
});

module.exports = mongoose.model('tokenmodel', OAuthTokenSchema);
