const mjml2html = require('mjml')
const nodemailer = require('nodemailer')
const config = require('./config')

const transport = nodemailer.createTransport({
  host: config.MAIL_HOST,
  port: config.MAIL_PORT,
  auth: {
    user: config.MAIL_USER,
    pass: config.MAIL_PASS,
  },
})

const options = {
  fonts: {
    'Open Sans': 'https://fonts.googleapis.com/css?family=Open+Sans:300,400,500,700',
  },
  keepComments: false,
  beautify: false,
  minify: true,
  filePath: '',
}

const makeAResponsiveEmail = text =>
  mjml2html(
    `
      <mjml>
        <mj-body>

          <!-- Company Header -->
          <mj-section background-color="#5ebfb5">
            <mj-column>
              <mj-text  font-style="italic"
                        font-size="20px"
                        color="#3f707d">
                Kyle &amp; Shelly&rqsuo;s Wedding
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Image Header -->
          <mj-section 
            background-url="https://kalm-wedding.netlify.com/static/34fefe41defad099b2f261a49bd12952/5f2bd/hero.png"
            background-size="cover"
            background-repeat="no-repeat"
          >
            <mj-column width="600px">
              <mj-text align="center" color="#fff" font-size="40px" font-family="Helvetica Neue">
                Password Reset
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Introduction Text -->
          <mj-section background-color="#fafafa">
            <mj-column width="400px">
              <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#626262">
                Reset Your Password
              </mj-text>
              <mj-text color="#525252">
                ${text}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `,
    options
  )

const makeANiceEmail = text => `
  <div className="email" style="
    border: 1px solid black;
    padding: 20px;
    font-family: sans-serif;
    line-height: 2;
    font-size: 20px;
    margin: 0 auto;
  ">
    <h2>Hello There</h2>
    <p>${text}</p>
    <p>😘, Kyle</p>
  </div>
`

exports.transport = transport
exports.makeANiceEmail = makeANiceEmail
exports.makeAResponsiveEmail = makeAResponsiveEmail
