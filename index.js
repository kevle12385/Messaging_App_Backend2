const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!');
});


const dbURI = "mongodb+srv://kevle12385:3916Cats@cluster0.ri2fueh.mongodb.net/"

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected…'))
  .catch(err => console.error(err));







app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
