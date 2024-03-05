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
  


  // In your functions.js or equivalent file
  module.exports = { createAccount, loginFunction,  };
