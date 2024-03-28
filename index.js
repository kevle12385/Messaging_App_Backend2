require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 3000;
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const { createAccount, loginFunction } = require('./functions');
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

const userConnections = new Map();

io.on('connection', (socket) => {
  const chatId = socket.handshake.query.chatId;
  console.log(`Client connected`);
  if (chatId) {
      // Join the socket to a room named after the chatId
      socket.join(chatId);

      // Example: Listening for a 'send_message' event to broadcast to the room
      socket.on('send_message', async (messageData) => {
        try {
          // Assuming sendMessageToDb is an async function that saves messageData to a database
          io.to(chatId).emit('receive_message',messageData);

          await sendMessageToDb(messageData);
          
          // Message saved successfully, broadcast or acknowledge the message
          console.log('New message received:', messageData);

        } catch (error) {
          console.error('Failed to save message:', error);
          // Optionally, inform the sender about the error
          socket.emit('error', 'Message could not be saved');
        }
      });
      

      socket.on('disconnect', () => {
        console.log(`Client disconnected`);

          // Socket.IO automatically handles leaving the room upon disconnection
          // Additional cleanup or notifications can be handled here
      });
  }
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

app.post('/api/friends/sendRequest', async (req, res) => {
  try {
    const { FriendID, AdderID } = req.body;

    const existingRequest = await client.db("User").collection("Friend_Requests")
    .findOne({
      UserId: FriendID,
      RequestFrom: AdderID
    });
  if (existingRequest) {
        return res.status(400).send("Friend request already exists.");
      }

    const updateResult = await client.db("User").collection("Friend_Requests")
      .insertOne({
        UserId: FriendID,
        RequestFrom: AdderID,
        createdAt: new Date()
      });
      res.status(200).send("Sent Sucessfully");
   
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request");
  }
});


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


app.post('/api/findFriendRequests', async (req, res) => {
  const { userID } = req.body;
  try {
    // Using find().toArray() to get the documents matching the UserID
    const friendRequests = await client.db("User").collection("Friend_Requests")
                              .find({ UserId: userID })
                              .toArray();

    if (!friendRequests.length) {
      // If no friend requests are found, you might want to send a different response
      return res.status(404).send("No friend requests found.");
    }

    // Sending the found friend requests back in the response
    res.status(200).json(friendRequests);

  } catch (error) {
    console.error('Error while finding friend requests:', error);
    res.status(500).send("Internal server error");
  }
});

app.post('/api/findPersonByID', async (req, res) => {
  const { userID } = req.body;
  try {
    // Make sure to pass `userID` to the function
    const person = await findUserByID(userID);
    if (person) {
      res.status(200).json(person);
    } else {
      // If no person found, return a 404 not found status
      res.status(404).send("Person not found");
    }
  } catch (error) {
    console.error('Error while finding person:', error);
    res.status(500).send("Internal server error");
  }
});

async function findUserByID(userID) {
  try {
    const db = client.db('User');
    const collection = db.collection('User_information');

    // Convert `userID` string to an ObjectId
    const user = await collection.findOne({_id: new ObjectId(userID)});
    console.log(user);

    return user;
    
  } catch (error) {
    console.log("Failed to find user by ID:", error);
    throw error;
  }
}

app.post('/api/enrichedFriendRequests', async (req, res) => {
  const { userID } = req.body;
  if (!userID) {
    return res.status(400).send("User ID is required.");
}    try {
  const enrichedFriendRequests = await findAndEnrichFriendRequests(userID);

  const enrichedData = enrichedFriendRequests.map(request => ({
    createdAt: request.createdAt,
    requesterDetails: request.requesterDetails
  }));
  

  // Send the enriched friend requests back to the client
  res.status(200).json(enrichedData);
} catch (error) {
  console.error('Error processing request:', error);
  res.status(500).send("Internal server error");
}
});

async function findAndEnrichFriendRequests(userID) {
  try {
      const db = client.db("User");
      const friendRequests = await db.collection("Friend_Requests")
          .find({ UserId: userID })
          .toArray();

      // Collect unique RequestFrom IDs
      const requestFromIds = [...new Set(friendRequests.map(req => req.RequestFrom))].map(id => new ObjectId(id));

      // Fetch user information in a single query
      const users = await db.collection("User_information")
          .find({ _id: { $in: requestFromIds } })
          .toArray();

      // Create a map for quicker user info lookup
      const userMap = users.reduce((acc, user) => {
          acc[user._id.toString()] = user;
          return acc;
      }, {});

      // Enrich friend requests with user info
      const enrichedFriendRequests = friendRequests.map(req => {
          return {
              ...req,
              requesterDetails: userMap[req.RequestFrom]
          };
      });

      return enrichedFriendRequests;
  } catch (error) {
      console.error("Error finding and enriching friend requests:", error);
      throw error;
  }
}


app.post('/api/deleteFriendRequestDoc', async (req, res) => {
  try {
    const { RequestFrom, userID } = req.body
    const db = client.db("User");
    const result = await db.collection("Friend_Requests").deleteOne({
      RequestFrom: RequestFrom,
      UserId: userID,
    }); 
    res.status(200).json(result);
  }catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request");
  }
});

app.post('/api/acceptFriendRequestDoc', async (req, res) => {
  console.log(req.body)
  try {
    const { RequestFrom, userID } = req.body;
    if (typeof userID !== 'string' || !userID.trim()) {
      return res.status(400).send("userID must be a non-empty string.");
    }
    if (typeof RequestFrom !== 'string' || !RequestFrom.trim()) {
      return res.status(400).send("RequestFrom must be a non-empty string.");
    }
    const db = client.db("User");
    
    // Update the accepting user's document to add the friend's _id to their list
    const updateResult = await db.collection("User_information").updateOne(
      { _id: new ObjectId(userID) },
      { $addToSet: { friends: RequestFrom } }
    );

    // Optionally, update the requester's document to reflect the friendship both ways
    const updateRequesterResult = await db.collection("User_information").updateOne(
      { _id: new ObjectId(RequestFrom) },
      { $addToSet: { friends: userID } }
    );
    console.log("RequestFrom ID:", RequestFrom);
    console.log("UserID (acceptor) ID:", userID);

    // If both updates are successful, proceed to delete the friend request document
    if (updateResult.modifiedCount > 0 && updateRequesterResult.modifiedCount > 0) {
      const deleteRequestResult = await db.collection("Friend_Requests").deleteOne({
        RequestFrom: RequestFrom,
        UserId: userID,
      });


    
      if (deleteRequestResult.deletedCount > 0) {
        res.status(200).json({ message: "Friend request accepted and friend request deleted." });
      } else {
        // The friend request document might have been missing or already deleted
        res.status(404).json({ message: "Friend request not found or already deleted." });
      }
    } else {
      // If the user documents were not updated, perhaps due to incorrect IDs
      res.status(404).json({ message: "User documents not updated. Check the provided IDs." });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request");
  }
});

app.post('/api/showFriendList', async (req, res) => {
  const { userID } = req.body;
  try {
    const db = client.db("User");
    // Assuming userID is stored as a string; convert to ObjectId if necessary
    const userDocument = await db.collection("User_information").findOne({ _id: new ObjectId(userID) });

    if (userDocument) {
      // If the document is found, return the friends array
      res.status(200).json({ friends: userDocument.friends });
    } else {
      // If no document is found for the provided userID
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error fetching friend list:", error);
    res.status(500).send("Error fetching friend list");
  }
});


app.post('/api/friendsDetails', async (req, res) => {
  try {
    const db = client.db("User");

    // Extract the array of IDs from the request body and convert them to ObjectId
    const friendIds = req.body.friends.map(id => new ObjectId(id));

    // Query the database for documents with _id in the friendIds array
    const friendsDetails = await db.collection("User_information")
      .find({ _id: { $in: friendIds } })
      .toArray();

    // Send the query results back to the client
    res.status(200).json(friendsDetails);
  } catch (error) {
    console.error("Error fetching friends' details:", error);
    res.status(500).send("Internal server error");
  } 
});




app.post('/api/friends/checkStatus', async (req, res) => {
  try {
    const { friendID, userID } = req.body;
    const db = client.db("User");
    // Since friendID is a string and matches the format in the database, no conversion is needed
    const userDocument = await db.collection("User_information").findOne({
      _id: new ObjectId(userID), // UserID is converted to ObjectId to match the _id field type
      friends: { $in: [friendID] } // Directly use friendID as a string in the query
    });

    if (userDocument) {
      // friendID found in the user's friends array
      res.json({ areFriends: true, message: 'Users are already friends.' });
    } else {
      // friendID not found in the user's friends array
      res.json({ areFriends: false, message: 'Users are not friends.' });
    }
  } catch (error) {
    console.error('Error checking friend status:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.post('/api/friends/remove', async (req, res) => {
  try {
    const { friendID, userID } = req.body;
    const db = client.db("User");

    // Remove friendID from the userID's friends list
    const response = await db.collection("User_information").updateOne(
      { _id: new ObjectId(userID) },
      { $pull: { friends: friendID } }
    );

    // Remove userID from the friendID's friends list
    const response1 = await db.collection("User_information").updateOne(
      { _id: new ObjectId(friendID) },
      { $pull: { friends: userID } }
    );

    // Check if both modifications were successful
    if (response.modifiedCount === 0 || response1.modifiedCount === 0) {
      if (response.modifiedCount === 0 && response1.modifiedCount === 0) {
        return res.status(404).send("Neither user found, or both users did not have each other in their friend list.");
      } else if (response.modifiedCount === 0) {
        return res.status(404).send("First user not found or did not have the second user in their friend list.");
      } else {
        return res.status(404).send("Second user not found or did not have the first user in their friend list.");
      }
    }

    res.status(200).send("Friendship removed successfully from both sides.");
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/createChatRoom', async (req, res) => {
  const { user1, user2, name1, name2 } = req.body;

  try {
    if (!user1 || typeof user1 !== 'string' || !user1.trim() || !user2 || typeof user2 !== 'string' || !user2.trim()) {
      return res.status(400).json({ message: "User IDs must be non-empty strings." });
    }

    const db = client.db("User");
    const chatRoomId = [user1, user2].sort().join('_');
    const names = [name1, name2]
    const response = await db.collection("Chat_Rooms").findOneAndUpdate(
      { _id: chatRoomId },
      
      { $setOnInsert: { users: [user1, user2], names: [name1, name2], messages: [] } },
      {
        upsert: true,
        returnOriginal: false
      }
    );

    // Since `findOneAndUpdate` with `upsert: true` will always return a document (either found or created),
    // you should not end up with `response.value` being `null`.
    // However, checking for the existence of `response.value` is still good practice.
    if (response && response.value) {
      res.status(200).json({ message: "Chat room handled successfully", chatRoom: response.value });
    } else {
      // This scenario should theoretically not happen due to the upsert, but it's handled just in case.
      res.status(200).json({ message: "Chat room not found and could not be created" });
    }
  } catch (error) {
    console.error('Failed to create or update chat room:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/api/showChatRooms', async (req, res) => {
  const { userId } = req.body; // Assuming you're sending a single userId to find chat rooms for

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return res.status(400).json({ message: "UserId must be a non-empty string." });
  }

  try {
    const db = client.db("User");
    const chatRooms = await db.collection("Chat_Rooms")
                              .find({ users: userId })
                              .toArray(); // Converts the cursor to an array

    if (chatRooms.length > 0) {
      res.status(200).json({ chatRooms });
    } else {
      res.status(404).json({ message: "No chat rooms found for the user" });
    }
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/api/findUserByEmail', async (req, res) => {
  const { Email } = req.body;
  try {
    const db = client.db("User");
    const userDocument = await db.collection("User_information").findOne({ Email });

    if (!userDocument) {
      // If no document is found, send a 404 response
      return res.status(404).json({ message: "No user found with that email." });
    }

    // Optionally, select which fields to send back to avoid sending sensitive information
    const { _id, name, Email: userEmail } = userDocument; // Example fields
    res.status(200).json({ _id, name, userEmail });
  } catch (error) {
    console.error('Error finding user information:', error);
    // Send a 500 Internal Server Error response if an error occurs
    res.status(500).json({ message: 'An error occurred while finding user information.' });
  }
});

async function sendMessageToDb(messageData) {
  try {
    const db = client.db("User");
    const chatRooms = db.collection("Chat_Rooms");

    // Assuming messageData includes user1 and user2 identifiers
    const user1 = messageData.user1;
    const chatRoomId = messageData.chatRoomId;

    const result = await chatRooms.updateOne(
      { _id: chatRoomId },
      { $push: { messages: messageData } } // Push the messageData to the messages array
    );
      console.log(messageData)
    // Moved outside of updateOne method call
    if (result.matchedCount === 1) {
      console.log(`Successfully added the message to chat room ${chatRoomId}`);
      // After successfully saving, broadcast the message to the room
      // Consider emitting a success acknowledgment or event here
    } else {
      console.log("Sending message to DB with data:", messageData);

      console.log(`Chat room ${chatRoomId} not found.`);
      // Handle the case where the chat room doesn't exist
      // Consider creating the chat room or handling the error differently
    }
  } catch (err) {
    console.error('Failed to save message to database', err);
    // Handle the error appropriately
    // Consider emitting an error acknowledgment or event here
  }
}


app.post('/api/deleteChatroom', async (req, res) => {
  const { user1, user2} = req.body;
  try {
    const db = client.db("User");
    const chatRooms = db.collection("Chat_Rooms");
    const query = {
      users: { $all: [user1, user2] }
    };
    const response = await chatRooms.findOneAndDelete(query);
    if (response.value) {

      res.json({ message: "Chatroom deleted successfully", chatroom: response.value });
    }
    } catch (error) {
    console.error("Failed to delete chatroom:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});














app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
