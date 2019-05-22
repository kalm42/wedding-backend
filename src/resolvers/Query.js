const { forwardTo } = require('prisma-binding')
const { requireLoggedInUser } = require('../utils')

const Query = {
  addresses: forwardTo('db'),
  me(parent, args, ctx, info) {
    if (!ctx.request.userId) return null
    return ctx.db.query.user({ where: { id: ctx.request.userId } }, info)
  },

  users(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    // hasPermissions(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE'])
    // return the users query
    return ctx.db.query.users({}, info)
  },

  emails(parent, args, ctx, info) {
    requireLoggedInUser(ctx)
    // return the email query
    const userId = ctx.request.user.id
    return ctx.db.query.emails({ where: { user: { id: userId } } }, info)
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
