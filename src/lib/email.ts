import sgMail from "@sendgrid/mail";
import { SECRET_MAIL_HOST, SECRET_MAIL_PORT, SECRET_MAIL_USER, SECRET_MAIL_PASS, ORIGIN, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_REPLYTO } from '$env/static/private';
import nodemailer from 'nodemailer';
sgMail.setApiKey(SECRET_MAIL_PASS);

export const createEmail = text => `
  <div className="email" style="
    border: 1px solid black;
    padding: 20px;
    font-family: sans-serif;
    line-height: 2;
    font-size: 20px;
  ">
    <h2>Tere!</h2>
    <p>${text}</p>

    <p><a href="${ORIGIN}">Tekstiks.ee</a>,</p>
    <p>Aivo Olev</p>
    <p><a href = "mailto:konetuvastus@taltech.ee?subject= Kontoga seotud küsimus">konetuvastus@taltech.ee</a></p>
  </div>
`;

/* export const sendEmail = info => 
  sgMail.send({
    to: info.to,
    from: "konetuvastus@taltech.ee",
    subject: info.subject,
    html: info.html,
  }) */

interface EmailInfo {
  to: string;
  subject: string;
  html: string;
}

const nodemailerConfig = {
  // SMTP configuration
  host: SMTP_HOST, // smtp_url indicates Office365
  port: SMTP_PORT, // Explicitly specified in smtp_url
  secure: true, // ssl_starttls implies STARTTLS, which is secure: true after upgrade
  auth: {
    user: SMTP_USER, // From smtp_url
    pass: SMTP_PASSWORD, // smtp_pass
  },
  tls: {
    minVersion: 'TLSv1.2', // Enforce minimum TLS version
    rejectUnauthorized: true, // Enable certificate validation
  },
  from: {
    name: 'Tekstiks.ee', // realname
    address: SMTP_FROM, // from
  },
  replyTo: SMTP_REPLYTO, // replyto (if you want to include it)
  // Other settings (not directly applicable to Nodemailer, but for context)
  // send_charset=utf-8 (Nodemailer defaults to UTF-8)
  // hostname = ttu.ee (This is typically used for the HELO/EHLO command, Nodemailer usually handles this automatically)
  // use_ipv6 = no (Nodemailer defaults to IPv4)
  // copy=no (This is a Mutt-specific setting for whether to copy sent messages)
  // Timeout settings (in milliseconds)
  connectionTimeout: 15000,    // 15 seconds
  greetingTimeout: 10000,     // 10 seconds
  socketTimeout: 20000,       // 20 seconds
};

export const sendEmail = async (info: EmailInfo) => {
  console.log('Sending email to', info.to);
  try {
    const transporter = nodemailer.createTransport(nodemailerConfig);

    // Add timeout promise
    const emailPromise = transporter.sendMail({
      from: SMTP_FROM,
      to: info.to,
      subject: info.subject,
      html: info.html,
    });

    // Race between email sending and timeout
    const result = await Promise.race([
      emailPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 30000) // 30 second timeout
      )
    ]);

    console.log('Email sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}