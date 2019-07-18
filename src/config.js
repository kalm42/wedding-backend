module.exports = {
  FRONTEND_URL: process.env.FRONTEND_URL,
  PRISMA_ENDPOINT: process.env.PRISMA_ENDPOINT,
  PRISMA_SECRET: process.env.PRISMA_SECRET,
  APP_SECRET: process.env.APP_SECRET,
  STRIPE_SECRET: process.env.STRIPE_SECRET,
  PORT: process.env.PORT,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASS: process.env.MAIL_PASS,
  LOB_SECRET_KEY: process.env.LOB_SECRET_KEY,
  permissions: ['ADMIN', 'USER'],
}
