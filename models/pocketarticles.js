const mongoose = require('mongoose');

const { Schema } = mongoose;

const BookmarkSchema = new Schema({
  title: {
    type: String,
    required: false,
  },
  url: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tags: {
    type: Array,
    required: false,
  },
  body: {
    type: String,
    required: false,
  },
  sync: {
    type: Boolean,
    default: false,
  },
  scraped: {
    type: Boolean,
    default: false,
  },
  dateOfEntry: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('scrapedarticles', BookmarkSchema);
