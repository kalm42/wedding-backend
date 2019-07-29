/* eslint-disable consistent-return */
require('dotenv').config({ path: '.env' })
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const createServer = require('./createServer')
const db = require('./db')

const server = createServer()

server.express.use(cookieParser())

server.express.use((req, res, next) => {
  const { token } = req.cookies
  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET)
    req.userId = userId
  }
  next()
})

server.express.use(async (req, res, next) => {
  if (!req.userId) return next()
  try {
    const user = await db.query.user(
      { where: { id: req.userId } },
      '{id, email, name, permissions}'
    )
    req.user = user
    next()
  } catch (error) {
    throw error
  }
})

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  deets => {
    // eslint-disable-next-line no-console
    console.log(
      `📬  Server is now running at http://localhost:${deets.port} with cors set for ${
        deets.cors.origin
      }`
    )
  }
)
