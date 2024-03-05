require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
const { createAccount, loginFunction } = require('./functions');

const cors = require('cors');
const bodyParser = require('body-parser'); // Needed for Express versions < 4.16.0
app.use(express.json());

const uri = process.env.MONGODB_URI;
app.use(cors({
  origin: 'http://localhost:5173' // Only allow requests from this origin
}));


app.get('/', (req, res) => {
  res.send('Hello World!');
});


const client = new MongoClient(uri);


async function main(){




  try {
      // Connect to the MongoDB cluster
      await client.connect();
      await  listDatabases(client);
      // await loginFunction(client, "kevle12385@ymail.com", "555dog")
  } catch (e) {
      console.error(e);
  } finally {
      
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


app.post('/api/login', async (req, res) => {
  const { Email, Password } = req.body; // Extract email and password from the JSON body of the request
  try {
    const result = await loginFunction(client, Email, Password);
    if (result.length === 0) {
      return res.status(401).send("Login Incorrect"); // No matching user found
    }
    // Proceed with login success response
    res.json(result); // Send back the result, though you might want to filter what's returned
  } catch (error) {
    console.error("Error fetching account", error);
    res.status(500).send("Internal server error");
  }
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
