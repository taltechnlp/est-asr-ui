import nodemailer from 'nodemailer';
// import mailjet from "node-mailjet";
import sgMail from "@sendgrid/mail";
import { SECRET_MAIL_HOST, SECRET_MAIL_PORT, SECRET_MAIL_USER, SECRET_MAIL_PASS } from '$env/static/private';

sgMail.setApiKey(SECRET_MAIL_PASS);
/* export const transport = nodemailer.createTransport({
  host: SECRET_MAIL_HOST,
  port: SECRET_MAIL_PORT,
  secure: false,
  auth: {
    user: SECRET_MAIL_USER,
    pass: SECRET_MAIL_PASS
  }
}); */

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

    <p><a href="https://tekstiks.ee">Tekstiks.ee</a>,</p>
    <p>Aivo Olev</p>
    <p><a href = "mailto:tugi@tekstiks.ee?subject= Kontoga seotud küsimus">tugi@tekstiks.ee</a></p>
  </div>
`;

/* const mailjetConnection = mailjet.apiConnect(
  SECRET_MAIL_USER,
  SECRET_MAIL_PASS
);
export const sendMail2 = info =>
  mailjetConnection.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: "info@tekstiks.ee",
          Name: "teksiks.ee"
        },
        To: [
          {
            Email: info.to,
            Name: "tekstiks.ee"
          }
        ],
        Subject: info.subject,
        //TextPart: "My first Mailjet email",
        HTMLPart: info.html,
        CustomID: "AppGettingStartedTest"
      }
    ]
  }); */
export const sendMail = info => 
  sgMail.send({
    to: info.to,
    from: "tugi@tekstiks.ee",
    subject: info.subject,
    html: info.html,
  })