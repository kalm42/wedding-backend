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
          <mj-section background-color="#f0f0f0">
            <mj-column>
              <mj-text  font-style="italic"
                        font-size="20px"
                        color="#626262">
                Easy Postal Service
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Image Header -->
          <mj-section 
            background-url="http://1.bp.blogspot.com/-TPrfhxbYpDY/Uh3Refzk02I/AAAAAAAALw8/5sUJ0UUGYuw/s1600/New+York+in+The+1960's+-+70's+(2).jpg"
            background-size="cover"
            background-repeat="no-repeat"
          >
            <mj-column width="600px">
              <mj-text align="center" color="#fff" font-size="40px" font-family="Helvetica Neue">
                Slogan here
              </mj-text>
              <mj-button background-color="#F63A4D" href="#">
                Promotion
              </mj-button>
            </mj-column>
          </mj-section>

          <!-- Introduction Text -->
          <mj-section background-color="#fafafa">
            <mj-column width="400px">
              <mj-text font-style="italic" font-size="20px" font-family="Helvetica Neue" color="#626262">
                My Awesome Text
              </mj-text>
              <mj-text color="#525252">
                ${text}
              </mj-text>
              <mj-button background-color="#F45E43" href="#">
                Learn more
              </mj-button>
            </mj-column>
          </mj-section>

          <!-- 2 columns section -->
          <!-- Side image -->
          <mj-section background-color="white">
            <!-- Left image -->
            <mj-column>
              <mj-image 
                width="200px" 
                src="https://designspell.files.wordpress.com/2012/01/sciolino-paris-bw.jpg" 
              />
            </mj-column>

            <!-- right paragraph -->
            <mj-column>
              <mj-text 
                font-style="italic" 
                font-size="20px" 
                font-family="Helvetica Neue" 
                color="#626262"
              >
                Find amazing places
              </mj-text>
              <mj-text color="#525252">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin rutrum enim eget magna efficitur, eu semper augue semper. Aliquam erat volutpat. Cras id dui lectus. Vestibulum sed finibus lectus.
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Icons -->
          <!-- Icons -->
          <mj-section background-color="#fbfbfb">
            <mj-column>
              <mj-image width="100px" src="http://191n.mj.am/img/191n/3s/x0l.png" />
            </mj-column>
            <mj-column>
              <mj-image width="100px" src="http://191n.mj.am/img/191n/3s/x01.png" />
            </mj-column>
            <mj-column>
              <mj-image width="100px" src="http://191n.mj.am/img/191n/3s/x0s.png" />
            </mj-column>
          </mj-section>

          <!-- Social icons -->
          <mj-section background-color="#e7e7e7">
            <mj-column>
              <mj-social>
                <mj-social-element name="facebook" />
              </mj-social>
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
