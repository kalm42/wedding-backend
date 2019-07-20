/* eslint-disable no-unused-vars */
const { forwardTo } = require('prisma-binding')
const { requireLoggedInUser, hasPermissions } = require('../utils')

const Query = {
  addresses: forwardTo('db'),
  address(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query.address(args.where, info)
  },
  me(parent, args, ctx, info) {
    if (!ctx.request.userId) return null
    return ctx.db.query.user({ where: { id: ctx.request.userId } }, info)
  },

  users(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    // return the users query
    return ctx.db.query.users({ orderBy: 'name_ASC' }, info)
  },
  user(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    // return the users query
    return ctx.db.query.user(args.where, info)
  },

  transactions(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    const userId = ctx.request.user.id
    return ctx.db.query.transactions(
      { where: { user: { id: userId } }, orderBy: 'createdAt_DESC' },
      info
    )
  },

  async giftStatus(parent, args, ctx, info) {
    const transactions = await ctx.db.query.transactions({}, `{id price gift}`)
    if (!transactions || transactions.length === 0) {
      return { gym: 0, honeymoon: 0 }
    }

    let gymGift = 0
    let honeymoonGift = 0
    transactions.map(transaction => {
      if (transaction.gift === 'GYM') {
        gymGift += transaction.price
      } else {
        honeymoonGift += transaction.price
      }
      return transaction
    })

    const total = gymGift + honeymoonGift
    const gym = Math.round((gymGift / total) * 100)
    const honeymoon = Math.round((honeymoonGift / total) * 100)
    if (gym + honeymoon !== 100) {
      return { gym, honeymoon: 100 - gym }
    }
    return { gym, honeymoon }
  },
  noRSVP(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query.users({ where: { rsvpToken_contains: '' }, orderBy: 'name_ASC' }, info)
  },
  RSVP(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query.users({ where: { rsvpToken: null }, orderBy: 'name_ASC' }, info)
  },
  unconfirmedGuestCount(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query
      .users({ where: { rsvpToken_contains: '' }, orderBy: 'name_ASC' }, '{ id guestCount} ')
      .then(data =>
        data
          .map(guest => guest.guestCount)
          .reduce((accumulator, guestCount) => accumulator + guestCount)
      )
  },
  confirmedGuestCount(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query
      .users({ where: { rsvpToken: null }, orderBy: 'name_ASC' }, '{ id guestCount} ')
      .then(data =>
        data
          .map(guest => guest.guestCount)
          .reduce((accumulator, guestCount) => accumulator + guestCount)
      )
  },
  noInvite(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query.users(
      { where: { invitations_every: { id: '' } }, orderBy: 'name_ASC' },
      info
    )
  },
}

module.exports = Query
