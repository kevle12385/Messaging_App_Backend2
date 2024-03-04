async function createAccount(client, newUser) {
    try {
      const result = await client.db('User').collection('User_information').insertOne(newUser);
      console.log(`New user created with the following id: ${result.insertedId}`);
    } catch (error) {
      console.error(`An error occurred while creating a new account: ${error}`);
    }
  }

  module.exports = createAccount;
