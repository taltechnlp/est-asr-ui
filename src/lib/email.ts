import sgMail from '@sendgrid/mail';
import {
	SECRET_MAIL_HOST,
	SECRET_MAIL_PORT,
	SECRET_MAIL_USER,
	SECRET_MAIL_PASS,
	ORIGIN,
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_FROM,
	SMTP_REPLYTO
} from '$env/static/private';
import nodemailer from 'nodemailer';
sgMail.setApiKey(SECRET_MAIL_PASS);

export const createEmail = (text) => `
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
	host: SMTP_HOST,
	port: SMTP_PORT, // Office 365 uses port 587 for TLS
	secure: false, // true for 465, false for other ports
	auth: {
		user: SMTP_USER,
		pass: SMTP_PASSWORD
	},
	tls: {
		ciphers: 'SSLv3',
		rejectUnauthorized: true // Keep this true for security
	},
	connectionTimeout: 10000,
	greetingTimeout: 10000,
	socketTimeout: 10000,
	from: {
		name: 'Tekstiks.ee',
		address: SMTP_FROM // Must match the authenticated user email
	},
	replyTo: SMTP_REPLYTO
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
			html: info.html
		});

		// Race between email sending and timeout
		const result = await Promise.race([
			emailPromise,
			new Promise(
				(_, reject) => setTimeout(() => reject(new Error('Email sending timeout')), 30000) // 30 second timeout
			)
		]);

		console.log('Email sent:', result.messageId);
		return true;
	} catch (error) {
		console.error('Error sending email:', error);
		return false;
	}
};
