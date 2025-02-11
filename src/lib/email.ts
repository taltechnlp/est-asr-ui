import sgMail from "@sendgrid/mail";
import { SECRET_MAIL_HOST, SECRET_MAIL_PORT, SECRET_MAIL_USER, SECRET_MAIL_PASS, ORIGIN } from '$env/static/private';

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
    <p><a href = "mailto:tugi@tekstiks.ee?subject= Kontoga seotud küsimus">tugi@tekstiks.ee</a></p>
  </div>
`;

export const sendMail = info => 
  sgMail.send({
    to: info.to,
    from: "tugi@tekstiks.ee",
    subject: info.subject,
    html: info.html,
  })