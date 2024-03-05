require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
const { createAccount, loginFunction,  } = require('./functions');
const jwt = require('jsonwebtoken'); // Ensure you've imported jwt

const app = express();
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


app.get('/posts', authenticateToken, async (req, res) => {
  try {
    // Assuming the authenticateToken middleware correctly attaches the decoded token to req.user
    const userId = req.user.userId; // Make sure this matches how you've attached the user info in authenticateToken

    // Using ObjectId from MongoDB to ensure the _id format matches
    const ObjectId = require('mongodb').ObjectId; 
    const userQuery = { _id: new ObjectId(userId) };

    // Fetch the user information excluding the password
    const userInformation = await client.db('User').collection('User_information').findOne(userQuery, {
      projection: { Password: 0 } // Exclude the password from the result
    });

    if (!userInformation) {
      return res.status(404).send("User not found.");
    }

    res.json(userInformation);
  } catch (error) {
    console.error("Error fetching user information", error);
    res.status(500).send("Internal server error");
  }
});

  
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) =>{
    if (err) return res.sendStatus(403)
    req.user = user
    next()
  })
}

app.delete('/api/logout', (req, res) => {
  //delete refresh token in data base
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
