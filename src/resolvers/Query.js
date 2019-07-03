const { forwardTo } = require('prisma-binding')
const { requireLoggedInUser } = require('../utils')

const Query = {
  addresses: forwardTo('db'),
  address(parent, args, ctx, info) {
    // requireLoggedInUser(ctx)
    // hasPermissions(ctx.request.user, ['ADMIN'])
    return ctx.db.query.address({ where: { id: args.id } }, info)
  },
  me(parent, args, ctx, info) {
    if (!ctx.request.userId) return null
    return ctx.db.query.user({ where: { id: ctx.request.userId } }, info)
  },

  users(parent, args, ctx, info) {
    // requireLoggedInUser(ctx)
    // hasPermissions(ctx.request.user, ['ADMIN'])
    // return the users query
    return ctx.db.query.users({ orderBy: 'name_ASC' }, info)
  },
  user(parent, args, ctx, info) {
    // requireLoggedInUser(ctx)
    // hasPermissions(ctx.request.user, ['ADMIN'])
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
}

module.exports = Query
