/* eslint no-unused-vars: warn */
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const config = require('../config')
const addressesController = require('../controllers/addresses')
const { transport, makeAResponsiveEmail } = require('../mail')
const { isPwnedPassword } = require('../utils')
const stripe = require('../stripe')

const Mutation = {
  async inviteGuest(parent, args, ctx, info) {
    // Does the user's address exist in the database
    const { line1, line2, city, state, zip } = args
    const address = { line1, line2, city, state, zip }
    address.hash = addressesController.getHash(address)
    const addressExists = await ctx.db.query.address({
      where: { hash: address.hash },
    })

    // Prep the user's address object
    const addressMutation = addressExists
      ? { connect: { hash: address.hash } }
      : { create: { hash: address.hash, line1, line2, city, state, zip } }

    // Prep the user
    const email = args.email.toLowerCase()
    const password = await bcrypt.hash(randomBytes(6).toString('hex'), 10)

    // Prep the RSVP Token
    const rsvpToken = randomBytes(3).toString('hex')
    // Wedding is on 6/20/20 I want to know 3 months in advance so ...
    const rsvpDeadline = new Date('March 20, 2020')
    const rsvpTokenExpiry = rsvpDeadline.getTime()

    // Create the user
    const user = await ctx.db.mutation
      .createUser(
        {
          data: {
            name: args.name,
            email,
            password,
            permissions: { set: ['USER'] },
            address: addressMutation,
            rsvpToken,
            rsvpTokenExpiry,
          },
        },
        info
      )
      .catch(err => {
        throw new Error(err)
      })

    return { message: 'Guest Added' }
  },

  async updateUser(parent, args, ctx, info) {
    /**
     *   updateUser(
          id: ID!
          name: String
          email: String
          isGoing: Boolean
          guestCount: Int
        ): User
     */
    const updates = { ...args }
    delete updates.id
    return ctx.db.mutation.updateUser(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    )
  },

  async signin(parent, { email, password }, ctx) {
    const user = await ctx.db.query.user({ where: { email } })
    if (!user) {
      throw new Error(`No such user found for email ${email}.`)
    }
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new Error('Invalid password')
    }
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    })
    return user
  },

  signout(parent, args, ctx) {
    ctx.response.clearCookie('token')
    return { message: 'Goodbye' }
  },

  async rsvp(parent, args, ctx) {
    // If the user is not going, they should not have to provide a password
    // it will also mean that they cannot change their mind.
    const isGoing = args.rsvpAnswer === 'true'

    // If they're not coming no matter what they wrote in guest count is zero
    const guestCount = isGoing ? Number(args.guestCount) : 0

    // args { password, confirmPassword, rsvpToken, rsvpAnswer, guestCount }
    if (isGoing && args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match.')
    }

    const [user] = await ctx.db.query.users({
      where: {
        rsvpToken: args.rsvpToken,
        rsvpTokenExpiry_gte: Date.now(),
      },
    })
    if (!user) {
      throw new Error('This rsvp token is either expired or not valid.')
    }

    const p = isGoing ? args.password : randomBytes(6).toString('hex')
    const password = await bcrypt.hash(p, 10)

    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        isGoing,
        guestCount,
        rsvpToken: null,
        rsvpTokenExpiry: null,
      },
    })

    const token = jwt.sign({ userId: updatedUser.id }, config.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    })
    return user
  },

  async requestReset(parent, { email }, ctx) {
    const user = await ctx.db.query.user({ where: { email } })
    if (!user) {
      throw new Error(`No such user found for email ${email}.`)
    }

    const resetToken = (await promisify(randomBytes)(20)).toString('hex')
    const resetTokenExpiry = Date.now() + 1000 * 60 * 60 // one hour
    await ctx.db.mutation.updateUser({
      data: { resetToken, resetTokenExpiry },
      where: { email },
    })

    const { html } = makeAResponsiveEmail(
      `Your password reset token is here! \n\n <a href="${
        config.FRONTEND_URL
      }/password-reset?resetToken=${resetToken}">Click Here to reset your password</a>`
    )

    const mailResponse = await transport.sendMail({
      from: 'donotreply@easypostalservice.com',
      to: user.email,
      subject: 'Your Password Reset Token',
      html,
    })
    if (!mailResponse.accepted) {
      throw new Error('Email failed to send.')
    }

    return { message: 'Reset token set' }
  },

  async resetPassword(parent, args, ctx) {
    if (args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match.')
    }

    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 1000 * 60 * 60,
      },
    })
    if (!user) {
      throw new Error('This token is either expired or not valid.')
    }

    const password = await bcrypt.hash(args.password, 10)
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: { password, resetToken: null, resetTokenExpiry: null },
    })

    const token = jwt.sign({ userId: updatedUser.id }, config.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    })
    return user
  },

  updatePermissions(parent, args, ctx, info) {
    const { userId, permissions } = args
    // requireLoggedInUser(ctx)
    // const { user } = ctx.request
    // hasPermissions(user, ['ADMIN', 'PERMISSIONUPDATE'])
    return ctx.db.mutation.updateUser(
      {
        data: { permissions: { set: permissions } },
        where: { id: userId },
      },
      info
    )
  },

  async createFundTransaction(parent, args, ctx, info) {
    // Get current user - make sure they're signed in
    const { userId } = ctx.request
    if (!userId) throw new Error('You must be signed in to give a gift.')
    const user = await ctx.db.query
      .user({ where: { id: userId } }, `{ id name email }`)
      .catch(err => {
        throw new Error(err)
      })

    // Confirm user is paying at least $10
    const { amount } = args
    if (amount < 1000) throw new Error('You must give at least $10.')

    // Create stripe charge
    const charge = await stripe.charges
      .create({
        amount,
        currency: 'USD',
        source: args.token,
        receipt_email: user.email,
      })
      .catch(err => {
        throw new Error(err)
      })

    // return transaction entry
    return ctx.db.mutation.createTransaction(
      {
        data: {
          type: 'STRIPE',
          price: amount,
          charge: {
            create: {
              charge: charge.id,
            },
          },
          user: {
            connect: {
              id: userId,
            },
          },
        },
      },
      info
    )
  },

  async updateAddress(parent, args, ctx, info) {
    // TODO: require logged in
    // TODO: require user to be self or admin
    const updates = { ...args }
    updates.hash = addressesController.getHash(updates)
    delete updates.id
    return ctx.db.mutation.updateAddress(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    )
  },
}

module.exports = Mutation
