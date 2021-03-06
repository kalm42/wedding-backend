/* eslint-disable func-names */
const fs = require('fs')
const path = require('path')
const config = require('../config')
// eslint-disable-next-line import/order
const Lob = require('lob')(config.LOB_SECRET_KEY, {
  apiVersion: '2019-06-01',
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
      from: 'adr_5258c8b00ae66fe0',
      front: fs.createReadStream(path.join(__dirname, '../postcard/PostcardFront.png')),
      back: 'tmpl_fcbddb53b5a4541',
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

module.exports = createPostcard
