/* eslint-disable func-names */
/* eslint no-unused-vars: warn */
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const config = require('../config')
// eslint-disable-next-line import/order
const createPostcard = require('../controllers/lob')
const addressesController = require('../controllers/addresses')
const { transport, makeAResponsiveEmail } = require('../mail')
const { isPwnedPassword, requireLoggedInUser, hasPermissions } = require('../utils')
const stripe = require('../stripe')

const Mutation = {
  async inviteGuest(parent, args, ctx, info) {
    // User must be logged in and admin.
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])

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
    const password = await bcrypt.hash(randomBytes(8).toString('hex'), 10)

    // Prep the RSVP Token
    const rsvpToken = randomBytes(3).toString('hex')
    // TODO: Verify not already assigned

    // Wedding is on 6/20/20 I want to know 3 months in advance so ...
    const rsvpDeadline = new Date('March 20, 2020')
    const rsvpTokenExpiry = rsvpDeadline.getTime()

    // Create the user
    const user = await ctx.db.mutation
      .createUser(
        {
          data: {
            name: args.name,
            guestCount: args.guestCount,
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

  async deleteGuest(parent, args, ctx, info) {
    // User must be admin
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.mutation.deleteUser({ where: { id: args.id } }, info)
  },

  async updateUser(parent, args, ctx, info) {
    // User must be admin or self
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'], args.id)
    const updates = { ...args }
    if (updates.password && isPwnedPassword(updates.password)) {
      throw new Error(
        'Your password has been found on the dark web. You cannot use it here, and you should change it anywhere you have used it.'
      )
    }
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
    const isGoing = args.rsvpAnswer === 'true'
    const guestCount = isGoing ? Number(args.guestCount) : 0
    if (isGoing && args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match.')
    }

    const [user] = await ctx.db.query.users({
      where: {
        rsvpToken: args.rsvpToken.toLowerCase(),
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
    if (await isPwnedPassword(args.password)) {
      throw new Error(
        'Your password has been found on the dark web. You cannot use it here, and you should change it anywhere you have used it.'
      )
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
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE'])
    const { userId, permissions } = args
    return ctx.db.mutation.updateUser(
      {
        data: { permissions: { set: permissions } },
        where: { id: userId },
      },
      info
    )
  },

  async createFundTransaction(parent, args, ctx, info) {
    const { token, amount, gift, name, line1, line2, city, state, zip } = args
    const isLoggedIn = !!ctx.request.userId
    let email = null
    if (isLoggedIn) {
      // eslint-disable-next-line prefer-destructuring
      email = ctx.request.user.email
    }

    if (amount < 1000) throw new Error('You must give at least $10.')

    const charge = {
      amount,
      currency: 'USD',
      source: token,
    }
    if (isLoggedIn) {
      charge.receipt_email = email
    }

    try {
      const stripeCharge = await stripe.charges.create({ ...charge })

      // Prepare the mutation for the database
      const transactionMutation = {
        data: {
          type: 'STRIPE',
          price: amount,
          gift: gift.toUpperCase() === 'GYM' ? 'GYM' : 'HONEYMOON',
          charge: { create: { charge: stripeCharge.id } },
        },
      }

      // User?
      if (isLoggedIn) {
        transactionMutation.data.user = { connect: { id: ctx.request.userId } }
      } else {
        // Name?
        if (name && name.length > 1) {
          transactionMutation.data.name = name
        }
        // Address?
        const addressHash = addressesController.getHash({ line1, line2, city, state, zip })
        if (addressHash) {
          // upsert the address
          const addressMutation = addressesController.prepareUpsertAddress({
            line1,
            line2,
            city,
            state,
            zip,
          })
          const address = await ctx.db.mutation.upsertAddress(addressMutation, '{ id }')
          transactionMutation.data.address = { connect: { id: address.id } }
        }
      }
      // Create the transaction now that all possibilities have been handled
      return ctx.db.mutation.createTransaction({ ...transactionMutation }, info)
    } catch (error) {
      throw error
    }
  },

  async updateAddress(parent, args, ctx, info) {
    // User must be admin or self
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'], args.id)
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

  async createInvitations(parent, args, ctx, info) {
    // Only logged in admins can perform
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])

    const allPossibleGuests = await ctx.db.query.users(
      {},
      '{ id name rsvpToken address { id line1 line2 city state zip }}'
    )
    const guests = allPossibleGuests.filter(user => !!user.rsvpToken)
    try {
      return guests.map(guest => createPostcard(guest, ctx.db, info))
    } catch (error) {
      throw error
    }
  },
  createInvitation(parent, args, ctx, info) {
    // Only logged in admins can perform
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])

    return ctx.db.query
      .user(
        { where: { id: args.userId } },
        '{ id name rsvpToken address { id line1 line2 city state zip }}'
      )
      .then(guest => {
        if (guest.rsvpToken === null) {
          throw new Error('User has no rsvp token.')
        }
        return createPostcard(guest, ctx.db, info)
      })
  },
}

module.exports = Mutation
