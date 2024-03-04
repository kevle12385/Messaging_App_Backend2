const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
app.get('/', (req, res) => {
  res.send('Hello World!');
});

const uri ="mongodb+srv://kevle12385:3916Cats@cluster0.ri2fueh.mongodb.net/";

const client = new MongoClient(uri);
async function main(){

  const uri = "mongodb+srv://kevle12385:3916Cats@cluster0.ri2fueh.mongodb.net/";


  const client = new MongoClient(uri);

  try {
      // Connect to the MongoDB cluster
      await client.connect();

      // Make the appropriate DB calls
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




app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
