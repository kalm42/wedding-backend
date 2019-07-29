/* eslint-disable func-names */
const fs = require('fs')
const path = require('path')
const config = require('../config')
// eslint-disable-next-line import/order
const Lob = require('lob')(config.LOB_SECRET_KEY, {
  apiVersion: '2018-06-05',
})

function createPostcardsPromise(param) {
  return new Promise((resolve, reject) => {
    Lob.postcards.create(param, function(err, res) {
      if (err !== null) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

function verifyUSAddressPromise(param) {
  return new Promise((resolve, reject) => {
    Lob.usVerifications.verify(param, function(err, res) {
      if (err !== null) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

function createPostcard(guest, db, info) {
  return new Promise((resolve, reject) => {
    createPostcardsPromise({
      description: `Wedding Invitation for ${guest.name}`,
      to: {
        name: guest.name,
        address_line1: guest.address.line1,
        address_line2: guest.address.line2,
        address_city: guest.address.city,
        address_state: guest.address.state,
        address_zip: guest.address.zip,
      },
      from: 'adr_b2323273b44e8575',
      front: fs.createReadStream(path.join(__dirname, '../postcard/PostcardFront.png')),
      back: 'tmpl_fcdaf3ed89d4a0a',
      merge_variables: { name: guest.name, code: guest.rsvpToken },
    })
      .then(card => {
        db.mutation
          .createInvitation(
            {
              data: {
                foreign_id: card.id,
                expected_delivery_date: card.expected_delivery_date,
                send_date: card.send_date,
                thumbnails: {
                  set: [card.thumbnails[0].medium, card.thumbnails[1].medium],
                },
                to: { connect: { id: guest.address.id } },
                user: { connect: { id: guest.id } },
              },
            },
            info
          )
          .then(invite => resolve(invite))
          .catch(err => reject(err))
      })
      .catch(err => reject(err))
  })
}

function verifyAddress(address) {
  const { line1, line2, city, state, zip } = address
  return new Promise((resolve, reject) => {
    verifyUSAddressPromise({
      primary_line: line1,
      secondary_line: line2,
      zip_code: zip,
      city,
      state,
    })
      .then(res => {
        resolve(res)
      })
      .catch(err => reject(err))
  })
}

module.exports = createPostcard
module.exports = verifyAddress
