async function createAccount(client, newUser) {
    try {
      const result = await client.db('User').collection('User_information').insertOne(newUser);
      console.log(`New user created with the following id: ${result.insertedId}`);
    } catch (error) {
      console.error(`An error occurred while creating a new account: ${error}`);
    }
  }

  async function loginFunction(client, email, password) {
    try {
      const result = await client.db('User').collection('User_information').find({
        Email: { $regex: new RegExp("^" + email + "$", "i") }, Password: password
      }).toArray();
            console.log(result)
            if (result.length === 0) {
              console.log('Login Incorrect');
            }
      return result;
    } catch (error) {
      console.error("Error occurred while fetching user information:", error);
      throw error;    
    }
  }
  
  async function sendMessageToDb(messageData) {
    try {
      const db = client.db("User");
      const chatRooms = db.collection("Chat_Rooms");
  
      // Assuming messageData includes user1 and user2 identifiers
      const user1 = messageData.user1;
      const user2 = messageData.user2;
      const chatRoomId = [user1, user2].sort().join('_');
  
      const result = await chatRooms.updateOne(
        { _id: chatRoomId },
        { $push: { messages: messageData } } // Push the messageData to the messages array
      );
  
      // Moved outside of updateOne method call
      if (result.matchedCount === 1) {
        console.log(`Successfully added the message to chat room ${chatRoomId}`);
        // After successfully saving, broadcast the message to the room
        // Consider emitting a success acknowledgment or event here
      } else {
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
  

  // In your functions.js or equivalent file
  module.exports = { createAccount, loginFunction, sendMessageToDb  };
