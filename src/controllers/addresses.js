const crypto = require('crypto')

module.exports = {
  getHash(address) {
    const { line1 = '', line2 = '', city = '', state = '', zip = '' } = address
    return crypto
      .createHash('sha1')
      .update(
        `${line1.toUpperCase()}${line2.toUpperCase()}${city.toUpperCase()}${state.toUpperCase()}${zip.toUpperCase()}`
      )
      .digest('base64')
  },

  /**
   * Takes in the address object from the Google Civic API and returns the
   * mutation object for the GraphQL prisma db.
   * @param {object} address
   *
   * * CREATE ADDRESSES
   * upsertAddress({
   *  where: { hash: String },
   *  create: {
   *    hash: String!,
   *    line1: String,
   *    line2: String,
   *    city: String,
   *    state: String,
   *    zip: String,
   *  },
   *  update: {
   *    line1: String,
   *    line2: String,
   *    city: String,
   *    state: String,
   *    zip: String,
   *  }
   * })
   */
  prepareUpsertAddress(address) {
    const hash = this.getHash(address)
    const { line1 = null, line2 = null, city = null, state = null, zip = null } = address
    const upsertAddress = {
      where: { hash },
      create: { hash, line1, line2, city, state, zip },
      update: { line1, line2, city, state, zip },
    }
    return upsertAddress
  },

  prepareAddressConnections(addresses) {
    if (!addresses) return []
    const connections = []
    for (let i = 0; i < addresses.length; i += 1) {
      const address = addresses[i]
      const hash = this.getHash(address)
      connections.push({ hash })
    }
    return connections
  },

  removeDuplicates(mutations) {
    const seen = []
    const filtered = mutations.filter(mutation => {
      if (!seen.includes(mutation.where.hash)) {
        seen.push(mutation.where.hash)
        return true // inclue the mutation
      }
      return false // exclude the mutation
    })
    return filtered
  },
}
