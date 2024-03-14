require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
const { createAccount, loginFunction,  } = require('./functions');
const jwt = require('jsonwebtoken'); // Ensure you've imported jwt
const app = express();
const cors = require('cors');
app.use(express.json());
const http = require('http');
const { Server } = require('socket.io');
const { Console } = require('console');

const server = http.createServer(app); // Create an http.Server instance from the Express app
const io = new Server(server); // Pass the http.Server instance to Socket




const uri = process.env.MONGODB_URI;
const corsOptions = {
  origin: true, // Allow only your frontend origin, adjust as needed
  optionsSuccessStatus: 200, // For legacy browser support
  credentials: true, // Allowing credentials is important for sessions/cookies
};
app.use(cors(corsOptions));

server.listen(3001, () => {
  console.log('Server is running')
})

io.on('connection', (socket) => {
 

  socket.on('send_message', (data) => {
    socket.broadcast.emit("recieve_message", data)
  })


  
  // Other socket event handlers
});









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


async function findUserByEmail(email) {
  try {
    const db = client.db('User');
    const collection = db.collection('User_information');

    const user = await collection.findOne({Email:email});

    return user;
    
  } catch (error) {
    console.log("Failed to find user by email:", error);
    throw error;
  }
  
}


app.post('/api/token', async (req, res) => {
  const { Email } = req.body;

  try {
    const user = await findUserByEmail(Email); // Ensure this is awaited
    if (!user) {
      return res.status(404).send("User not found");
    }

    const now = new Date();
    // Check if the stored refresh token is expired
    if (user.refreshTokenExpiry && now > user.refreshTokenExpiry) {
      return res.status(403).send("Refresh token expired");
    }

    // Generate a new access token if the refresh token hasn't expired
    const accessToken = generateAccessToken({ userId: user._id.toString() });
    res.json({ accessToken });
    
  } catch (error) {
    console.error("Error processing token request", error);
    res.status(500).send("Internal server error");
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

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // Set the expiry date to 7 days from now
    console.log({
      userId: user._id,
      refreshToken,
      refreshTokenExpiry,
    });
    
    // Store the refresh token in the database associated with the user
    await client.db("User").collection("User_information").updateOne(
      { _id: user._id },
      { 
        $set: {
          refreshToken: refreshToken,
          refreshTokenExpiry: refreshTokenExpiry // Storing the expiration date
        } 
      }
    );


    // Send the access token as an HTTP-only cookie
    res.json({
      message: 'Login successful',
      accessToken,// Note: This is being set in an HTTP-only cookie as well
      Email: Email 
    });
        
    
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

app.get('/api/verify', (req, res) => {
  // Access the cookies from the request
  const accessToken = req.cookies['accessToken'];

  // Check if the accessToken exists
  if (!accessToken) {
    // If the accessToken cookie does not exist, return a 401 Unauthorized response
    return res.status(401).json({ error: 'Access Denied: No token provided.' });
  }
});

app.get('/api/people', async (req, res) => {
  try {
    // Dynamically get the excluded email from query params
    const excludedEmail = req.query.excludeEmail; // Accessing the excludeEmail parameter from the request query string

    // Create a query object that excludes the specified email, if any
    let query = {};
    if (excludedEmail) {
  query.Email = { $ne: excludedEmail.trim() }; // Note the capital 'E' in 'Email'
}


    const UserInfo = await client.db("User").collection("User_information")
                          .find(query, { projection: { _id: 1, name: 1 } }) // Use projection to include only the name field
                          .toArray();

    res.json(UserInfo);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('api/friends/sendRequest', async (req, res) => {
  try {
    const { FriendID, AdderID } = req.body;

    const updateResult =  await client.db("User").collection("Friend_Requests")
    .insertOne({UserId: FriendID, 
                RequestFrom: AdderID,
                createdAt: new Date()})
  } catch (error) {
    console.error("Error processing request:", error);
    res.status
  }
})

app.post('/api/UserID/get', async (req, res) => {
  const { Email } = req.body;
  try {
    const user = await findUserByEmail(Email); // Ensure this function is implemented to find the user
    if (!user) {
      return res.status(404).send("User not found");
    }
    // Assuming the user object contains the information you want to return
    res.status(200).json(user._id); // Or res.status(200).send({ userID: user.id }) if you're only sending the ID
  } catch (error) {
    console.error("Error processing User Info request", error);
    res.status(500).send("Internal server error");
  }
});





app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
