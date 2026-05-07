import { ORIGIN } from '$env/static/private';
import { createEmail } from '$lib/email';

type Lang = 'et' | 'en' | 'fi';

const messages: Record<Lang, { subject: string; body: (link: string) => string }> = {
    et: {
        subject: 'Kinnita oma e-posti aadress - tekstiks.ee',
        body: (link) => `Tere tulemast tekstiks.ee teenusesse!

        \n\n
        Palun kinnita oma e-posti aadress, et lõpetada konto loomine. Link aegub 24 tunni jooksul.

        \n\n
        <a href="${link}">Kinnita e-posti aadress</a>

        \n\n
        Kui sa ei loonud kontot, siis võid selle kirja ignoreerida.`
    },
    en: {
        subject: 'Confirm your email address - tekstiks.ee',
        body: (link) => `Welcome to tekstiks.ee!

        \n\n
        Please confirm your email address to finish creating your account. The link expires in 24 hours.

        \n\n
        <a href="${link}">Confirm email address</a>

        \n\n
        If you did not create an account, you can ignore this email.`
    },
    fi: {
        subject: 'Vahvista sähköpostiosoitteesi - tekstiks.ee',
        body: (link) => `Tervetuloa tekstiks.ee-palveluun!

        \n\n
        Vahvista sähköpostiosoitteesi viimeistelläksesi tilin luomisen. Linkki vanhenee 24 tunnin kuluttua.

        \n\n
        <a href="${link}">Vahvista sähköpostiosoite</a>

        \n\n
        Jos et luonut tiliä, voit jättää tämän viestin huomiotta.`
    }
};

export const buildVerificationEmail = (token: string, language: string) => {
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
