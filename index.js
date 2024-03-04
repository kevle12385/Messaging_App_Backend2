require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { createAccount } = require('./functions');

const uri = process.env.MONGODB_URI;


app.get('/', (req, res) => {
  res.send('Hello World!');
});


const client = new MongoClient(uri);
async function main(){



  const client = new MongoClient(uri);

  try {
      // Connect to the MongoDB cluster
      await client.connect();
      await  listDatabases(client);
     
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
  }
}

main().catch(console.error);

async function listDatabases(client){
  databasesList = await client.db().admin().listDatabases();

  console.log("Databases:");
  databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};



app.post('/api/create-account', async (req, res) => {
  const newUser = req.body;
  try {
    await createAccount(client, newUser); // Assuming `client` is your MongoDB client instance
    res.status(201).send({ message: 'Account created successfully' });
  } catch (error) {
    res.status(500).send({ message: `An error occurred: ${error.message}` });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
