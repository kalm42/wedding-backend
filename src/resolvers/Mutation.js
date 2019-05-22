/* eslint no-unused-vars: warn */
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const config = require('../config')
const addressesController = require('../controllers/addresses')
const { transport, makeAResponsiveEmail } = require('../mail')
const { isPwnedPassword, requireLoggedInUser } = require('../utils')
const stripe = require('../stripe')

const Mutation = {
  async signup(parent, args, ctx, info) {
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
    const password = await bcrypt.hash(args.password, 10)

    // Confirm password has not been pwned.
    const isPwned = await isPwnedPassword(args.password)
    if (isPwned) {
      throw new Error('Password is pwned')
    }

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
            emails: { create: [{ email, isActive: true }] },
          },
        },
        info
      )
      .catch(err => {
        throw new Error(err)
      })

    // Return the user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    })
    return user
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

  createEmail(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    const { user } = ctx.request
    // TODO: Add validation that email string is an email
    return ctx.db.mutation.createEmail(
      {
        data: {
          user: {
            connect: {
              id: user.id,
            },
          },
          ...args,
        },
      },
      info
    )
  },

  async toggleEmail(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    const userId = ctx.request.user.id;
    const where = { id: args.id }
    const email = await ctx.db.query.email({ where }, `{ id, isActive, user { id } }`)
    // TODO: Verify that current User owns the email address
    const ownsEmail = email.user.id === userId
    if (!ownsEmail) {
      throw new Error('You do not have the appropriate permissions to delete this email')
    }
    return ctx.db.mutation.updateEmail(
      { data: { isActive: !email.isActive }, where: { id: email.id } },
      info
    )
  },

  async createFundTransaction(parent, args, ctx, info) {
    // Get current user - make sure they're signed in
    const { userId } = ctx.request
    if (!userId) throw new Error('You must be signed in to add funds to your account.')
    const user = await ctx.db.query
      .user({ where: { id: userId } }, `{ id name email balance }`)
      .catch(err => {
        throw new Error(err)
      })

    // Confirm user is paying at least $10
    const { amount } = args
    if (amount < 1000) throw new Error('You must fund your account with at least $10.')

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

    // Update users's balance
    await ctx.db.mutation
      .updateUser({
        where: { id: userId },
        data: { balance: user.balance + amount },
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
}

module.exports = Mutation
