const { createHash } = require('crypto')
const fetch = require('node-fetch')

function requireLoggedInUser(ctx) {
  if (!ctx.request.userId) {
    throw new Error('You must be logged in to perform this action!')
  }
  return true
}

function hasPermissions(user, permissionsNeeded) {
  const matchedPermissions = user.permissions.filter(permissionTheyHave =>
    permissionsNeeded.includes(permissionTheyHave)
  )

  if (!matchedPermissions.length) {
    throw new Error(`You do not have sufficient permissions

      : ${permissionsNeeded}

      You Have:

      ${user.permissions}
      `)
  }
}

async function isPwnedPassword(password) {
  const hash = createHash('sha1')
    .update(password)
    .digest('hex')
  const hashPrefix = hash.substr(0, 5)
  const hashSuffix = hash.substr(5).toUpperCase()
  const url = `https://api.pwnedpasswords.com/range/${hashPrefix}`

  const result = await fetch(url)
    .then(res => {
      if (res.status !== 200 && res.status !== 404) {
        throw new Error(`Failed to fetch password comparisons. Status Code ${res.status}`)
      }
      if (res.status === 404) return false

      return res.text()
    })
    .catch(err => {
      throw new Error(err)
    })

  if (result) {
    const results = result
      .split('\r\n')
      .map(line => line.split(':'))
      .filter(line => line[0] === hashSuffix)
      .shift()
    return !!results
  }
  return false
}

exports.requireLoggedInUser = requireLoggedInUser
exports.hasPermissions = hasPermissions
exports.isPwnedPassword = isPwnedPassword
