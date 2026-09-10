import { ORIGIN } from '$env/static/private';
import { createEmail } from '$lib/email';

type Lang = 'et' | 'en' | 'fi';

const messages: Record<Lang, { subject: string; body: (link: string) => string }> = {
    et: {
        subject: 'Kinnita oma uus e-posti aadress - tekstiks.ee',
        body: (link) => `Sinu tekstiks.ee konto e-posti aadressi soovitakse muuta sellele aadressile.

        \n\n
        Palun kinnita uus aadress, et muudatus jõustuks. Link aegub 24 tunni jooksul.

        \n\n
        <a href="${link}">Kinnita uus e-posti aadress</a>

        \n\n
        Kui sa seda muudatust ei taotlenud, siis võid selle kirja ignoreerida. Aadressi ei muudeta enne, kui sa lingile klõpsad.`
    },
    en: {
        subject: 'Confirm your new email address - tekstiks.ee',
        body: (link) => `A request was made to change the email address of your tekstiks.ee account to this address.

        \n\n
        Please confirm the new address to complete the change. The link expires in 24 hours.

        \n\n
        <a href="${link}">Confirm new email address</a>

        \n\n
        If you did not request this change, you can ignore this email. The address will not be changed until you click the link.`
    },
    fi: {
        subject: 'Vahvista uusi sähköpostiosoitteesi - tekstiks.ee',
        body: (link) => `tekstiks.ee-tilisi sähköpostiosoitetta on pyydetty vaihdettavaksi tähän osoitteeseen.

        \n\n
        Vahvista uusi osoite, jotta muutos tulee voimaan. Linkki vanhenee 24 tunnin kuluttua.

        \n\n
        <a href="${link}">Vahvista uusi sähköpostiosoite</a>

        \n\n
        Jos et pyytänyt tätä muutosta, voit jättää tämän viestin huomiotta. Osoitetta ei vaihdeta ennen kuin napsautat linkkiä.`
    }
};

export const buildEmailChangeEmail = (token: string, language: string) => {
    const lang: Lang = (['et', 'en', 'fi'] as const).includes(language as Lang)
        ? (language as Lang)
        : 'et';
    const link = `${ORIGIN}/${lang}/verify-email?token=${token}`;
    const { subject, body } = messages[lang];
    return {
        subject,
        html: createEmail(body(link))
    };
};
