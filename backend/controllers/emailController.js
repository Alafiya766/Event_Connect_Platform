const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send payment confirmation emails to user & organizer
 * @param {Object} params
 * @param {Object} params.user - { name, email }
 * @param {Object} params.organizer - { name, email }
 * @param {Object} params.event - { name, date, location }
 * @param {Number} params.amount - payment amount
 */
async function sendPaymentEmails({ user, organizer, event, amount }) {
  // Email to user
  const userMailOptions = {
    from: `"${event.name} | EventConnect" <${process.env.EMAIL_USER}>`,
    to: user.email,
    replyTo: organizer.email,
    subject: `Payment Successful for ${event.name}`,
    html: `<h2>Hello ${user.name}</h2>
<p>Your payment of ₹${amount} for the event "<b>${event.name}</b>" was successful!</p>
<p><b>Date:</b> ${new Date(event.date).toLocaleDateString("en-GB")}<br>
<b>Location:</b> ${event.location}</p>
<p>Thank you for registering! We look forward to seeing you at the event.</p>
<p>Best regards,<br>${organizer.name}</p>`,
  };

  // Optional: Email to organizer
  const organizerMailOptions = {
    from: `"EventConnect" <${process.env.EMAIL_USER}>`,
    to: organizer.email,
    subject: `New Registration for ${event.name}`,
    text: `Hello ${organizer.name},

${user.name} has successfully registered and paid ₹${amount} for your event "${event.name}".

Event Details:
- Date: ${new Date(event.date).toLocaleDateString("en-GB")}
- Location: ${event.location}

You can contact the participant at ${user.email} if needed.

Best regards,
EventConnect Platform`,
  };

  // Send emails in parallel
  await Promise.all([
    transporter.sendMail(userMailOptions),
    transporter.sendMail(organizerMailOptions),
  ]);
}

module.exports = { sendPaymentEmails };