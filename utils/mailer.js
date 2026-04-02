const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "shivamshinde786@gmail.com",
    pass: "iyec ykea gljb wnmr" // use App Password, not your main password
  }
});

async function sendNotification(to, subject, text) {
  await transporter.sendMail({
    from: "shivamshinde786@gmail.com",
    to,
    subject,
    text
  });
}

module.exports = sendNotification;
