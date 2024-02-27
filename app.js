const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

app.use(express.json())

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running')
    })
  } catch (error) {
    console.log(`DB Error: ${error.message};`)
    process.exit(1)
  }
}
initializeDbAndServer()


const getFollowingPeopleIdsOfUser = async username => {
  const getTheFollowingPeopleQuery = `SELECT following_user_id FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE user.username = '${username}';`
  const followingPeople = await db.all(getTheFollowingPeopleQuery)
  const arrayOfIds = followingPeople.map(eachUser => eachUser.following_user_id)
  return arrayOfIds
}
//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

const jwtVerification = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken) {
    jwt.verify(jwtToken, 'SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401).send('Invalid JWT Token')
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  } else {
    response.status(401).send('Invalid JWT Token')
  }
}

// Get user followers endpoint
app.get('/user/followers/', jwtVerification, async (request, response) => {
  const {userId} = request
  const getFollowersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE following_user_id = '${userId}';`
  try {
    const followers = await db.all(getFollowersQuery)
    const followerNames = followers.map(follower => follower.name)
    response.json({followers: followerNames})
  } catch (error) {
    console.error('Error fetching followers:', error)
    response.status(500).send('Internal Server Error')
  }
})

// Register endpoint
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const userDBDetails = await db.get(getUserQuery)

  if (userDBDetails !== undefined) {
    response.status(400).send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400).send('Password is too short')
    } else {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUserQuery = `INSERT INTO user(username, password, name, gender)
        VALUES('${username}','${hashedPassword}','${name}','${gender}');`

      try {
        // Execute the query to create user in the database
        await db.run(createUserQuery)
        response.send('User created successfully') // Success response
      } catch (error) {
        response.status(500).send('Internal Server Error')
      }
    }
  }
})

// Login endpoint
// app.post('/login/', async (request, response) => {
//   const {username, password} = request.body
//   const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`
//   const userDBDetails = await db.get(getUserQuery)

//   if (userDBDetails === undefined) {
//     response.status(400).send('Invalid user') // Unregistered user
//   } else {
//     const isPasswordCorrect = await bcrypt.compare(
//       password,
//       userDBDetails.password,
//     )

//     if (isPasswordCorrect) {
//       const payload = {username, userId: userDBDetails.user_id}
//       const jwtToken = jwt.sign(payload, 'SECRET_KEY')

//       response.send({jwtToken}) // Respond with JWT Token
//     } else {
//       response.status(400).send('Invalid password') // Incorrect password
//     }
//   }
// })

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  try {
    const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`
    const userDBDetails = await db.get(getUserQuery)

    if (!userDBDetails) {
      response.status(400).send('Invalid user') // Unregistered user
      return // Exit function
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      userDBDetails.password,
    )

    if (isPasswordCorrect) {
      const payload = {username, userId: userDBDetails.user_id}
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')

      response.send({jwtToken}) // Respond with JWT Token
    } else {
      response.status(400).send('Invalid password') // Incorrect password
    }
  } catch (error) {
    console.error('Error during login:', error)
    response.status(500).send('Internal Server Error')
  }
})

// Get user tweets feed endpoint
app.get('/user/tweets/feed/', jwtVerification, async (request, response) => {
  const {username} = request

  const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)
  const followingPeopleIdsStr = followingPeopleIds.join(', ')
  const getTweetsQuery = `SELECT username, tweet, date_time as dateTime FROM user
    INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE user.user_id IN (${followingPeopleIdsStr})
    ORDER BY date_time DESC
    LIMIT 4;`

  const tweets = await db.all(getTweetsQuery)
  response.send(tweets)
})

// Get user following endpoint
app.get('/user/following/', jwtVerification, async (request, response) => {
  const {userId} = request
  const getFollowingUsersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE follower_user_id = '${userId}';`
  const followingUsers = await db.all(getFollowingUsersQuery)
  const names = followingUsers.map(user => user.name)
  response.send(names)
})

// Get user followers endpoint
app.get('/user/follower/', jwtVerification, async (request, response) => {
  const {userId} = request
  const getFollowersQuery = `SELECT name FROM follower
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE following_user_id = '${userId}';`
  const followers = await db.all(getFollowersQuery)
  const names = followers.map(user => user.name)
  response.send(names)
})

// Get user tweets endpoint
// Get user tweets endpoint
app.get('/user/tweets/', jwtVerification, async (request, response) => {
  const {userId} = request
  const getTweetsQuery = `SELECT tweet, date_time as dateTime FROM tweet
    WHERE user_id = ${userId};`
  try {
    const tweets = await db.all(getTweetsQuery)
    response.json(tweets)
  } catch (error) {
    console.error('Error fetching user tweets:', error)
    response.status(500).send('Internal Server Error')
  }
})

// Get tweet details endpoint
// Get tweet details endpoint
app.get('/tweets/:tweetId/', jwtVerification, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request

  // Query to fetch tweet details
  const getTweetQuery = `SELECT tweet, date_time as dateTime FROM tweet
    WHERE tweet_id = ${tweetId};`

  try {
    // Execute query to fetch tweet details
    const tweetDetails = await db.get(getTweetQuery)

    if (!tweetDetails) {
      response.status(404).send('Invalid Request')
      return
    }

    // Check if the user is authorized to view the tweet
    const tweetOwnerQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`
    const tweetOwner = await db.get(tweetOwnerQuery)

    if (!tweetOwner) {
      response.status(404).send('Tweet not found')
      return
    }

    const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)
    if (!followingPeopleIds.includes(tweetOwner.user_id)) {
      response.status(401).send('Unauthorized')
      return
    }

    // Send tweet details as response
    response.json(tweetDetails)
  } catch (error) {
    console.error('Error fetching tweet details:', error)
    response.status(500).send('Internal Server Error')
  }
})

// Get likes of a tweet endpoint
app.get(
  '/tweets/:tweetId/likes/',
  jwtVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request

    const getTweetUserQuery = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`
    const tweetUser = await db.get(getTweetUserQuery)

    if (tweetUser === undefined) {
      response.status(404).send('Tweet not found')
    } else {
      const tweetOwnerId = tweetUser.user_id
      const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)

      if (!followingPeopleIds.includes(tweetOwnerId)) {
        response.status(401).send('Invalid Request')
      } else {
        const getLikesQuery = `SELECT username FROM user INNER JOIN like ON user.user_id = like.user_id WHERE tweet_id = '${tweetId}';`
        const likedUsers = await db.all(getLikesQuery)
        const usersArray = likedUsers.map(eachUser => eachUser.username)
        response.send({likes: usersArray})
      }
    }
  },
)

// Get replies of a tweet endpoint
app.get(
  '/tweets/:tweetId/replies/',
  jwtVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request

    const getTweetUserQuery = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`
    const tweetUser = await db.get(getTweetUserQuery)

    if (tweetUser === undefined) {
      response.status(404).send('Tweet not found')
    } else {
      const tweetOwnerId = tweetUser.user_id
      const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)

      if (!followingPeopleIds.includes(tweetOwnerId)) {
        response.status(401).send('Invalid Request')
      } else {
        const getRepliedQuery = `SELECT name, reply FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE tweet_id = '${tweetId}';`
        const repliedUsers = await db.all(getRepliedQuery)
        response.send({replies: repliedUsers})
      }
    }
  },
)

// Create tweet endpoint
app.post('/user/tweets/', jwtVerification, async (request, response) => {
  const {tweet} = request.body
  const {userId} = request
  const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
  const createTweetQuery = `INSERT INTO tweet(tweet, user_id, date_time) VALUES('${tweet}', '${userId}', '${dateTime}');`

  try {
    await db.run(createTweetQuery)
    response.send('Created a Tweet')
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

// Delete tweet endpoint
app.delete('/tweets/:tweetId/', jwtVerification, async (request, response) => {
  const {tweetId} = request.params
  const {userId} = request

  const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id = '${userId}' AND tweet_id = '${tweetId}';`
  const tweet = await db.get(getTheTweetQuery)

  if (tweet === undefined) {
    response.status(401).send('Invalid Request')
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = '${tweetId}';`
    try {
      await db.run(deleteTweetQuery)
      response.send('Tweet Removed')
    } catch (error) {
      response.status(500).send('Internal Server Error')
    }
  }
})

module.exports = app
