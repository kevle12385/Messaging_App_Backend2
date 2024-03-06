require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
const { createAccount, loginFunction,  } = require('./functions');
const jwt = require('jsonwebtoken'); // Ensure you've imported jwt
const app = express();
const cors = require('cors');
app.use(express.json());
const server = require("http").createServer
const io = require('socket.io')(server, {
  transports: ['websocket',  'polling']
});




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

app.get('/api/verify', (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).send('not logged in');
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send('Invalid or expired token');
    }
    res.send('logged in')
  });

});



app.post('/api/token', async (req, res) => {
    const refreshToken = req.body.token;
    if (!refreshToken) return res.status(401).send("Refresh token is required");

    try {
        const payload = await validateRefreshToken(refreshToken);
        if (!payload) return res.status(403).send("Invalid refresh token");

        // Generate new tokens
        const accessToken = generateAccessToken({ name: payload.name });
        // Optionally generate a new refresh token here if you're rotating them

        res.json({ accessToken }); // , refreshToken: newRefreshToken if you're rotating
    } catch (error) {
        console.error("Error refreshing token", error);
        return res.status(500).send("Internal server error");
    }
});


app.post('/api/login', async (req, res) => {
  const { Email, Password } = req.body; // Extract email and password from the JSON body of the request
  
  try {
    const result = await loginFunction(client, Email, Password);
    if (result.length == 0) {
      return res.status(401).send("Login Incorrect"); 
    }
    
    const user = result[0];
    const accessToken = generateAccessToken({ userId: user._id.toString() }); // Ensure minimal and necessary info in token
    const refreshToken = jwt.sign({ userId: user._id.toString() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    // Store the refresh token in the database associated with the user
    await client.db("User").collection("User_information").updateOne(
      { _id: user._id },
      { $set: { refreshToken: refreshToken } }
    );

    // Send the access token as an HTTP-only cookie
    res.cookie('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 15 * 60 * 1000 });

    res.send('Login successful');
  } catch (error) {
    console.error("Error fetching account", error);
    res.status(500).send("Internal server error");
  }
});


async function findUserByRefreshToken(token) {
  return await client.db("User").collection("User_information").findOne({ refreshToken: token });
}


async function validateRefreshToken(token) {
  try {
      const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      // Look up the token in the database to ensure it's still valid
      const user = await findUserByRefreshToken(token); // Implement this function based on your DB
      return user ? payload : null;
  } catch (error) {
      return null; // Token validation failed
  }
}


function generateAccessToken(user) {
  // Including only the user's ID in the JWT payload
  const payload = { userId: user._id };
  
  // Signing the token with an expiration time of 15 minutes
  try {
      return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
  } catch (error) {
      console.error("Error generating access token:", error);
      throw new Error("Failed to generate access token.");
  }
}

app.post('/api/logout', (req, res) => {
  res.clearCookie('accessToken'); // Clears the HttpOnly cookie
  res.status(200).send('Logged out successfully');
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
