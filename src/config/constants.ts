export const MESSAGES = {
    WELCOME: (firstName: string) =>
        `👋 Witaj, ${firstName}!\n\n` +
        `🎓 *Witamy na kursie!*\n\n`,

    COURSE_SCHEDULED: '📅 Nowe lekcje będą wysyłane codziennie o 10:00',
    COURSE_INSTANT: '⚡ Lekcje będą wysyłane automatycznie',

    PAUSE: '⏸ *Kurs wstrzymany*\n\nWpisz /resume aby kontynuować',
    ALREADY_PROCESSING: '✅ Kurs już trwa',
    FINISH_QUIZ: '📝 Dokończ najpierw aktualny test wiedzy',
    FINISH_ASSESSMENT: '🔍 Dokończ najpierw aktualny test samooceny',

    COURSE_RESET: '✅ Kurs został zresetowany',
    COURSE_COMPLETED: '🎉 *Gratulacje!* Ukończyłeś cały kurs! 🏆',

    ERROR_GENERIC: '❌ Wystąpił błąd. Spróbuj ponownie /resume',
    ERROR_OVERLOAD: '⏳ System przeciążony. Spróbuj później.',
    ERROR_RATE_LIMIT: '⏳ Zbyt wiele żądań. Spróbuj ponownie za chwilę.',

    NO_ACCESS: '⛔ Nie masz dostępu do tego polecenia',
};

export const LIMITS = {
    MESSAGE_MAX_LENGTH: 4000,
    RETRY_ATTEMPTS: 3,
    QUIZ_PASS_SCORE: 70,
};

export const DEV_MEDIA = {
    PHOTO: 'AgACAgIAAxkBAAIBDmjkX0tF2ZbPRObEDGInCGJgdb7QAAKwAzIbdjcgS__zjr1w3Ou3AQADAgADeQADNgQ',
    VIDEO: 'BAACAgIAAxkBAAOmaNkRnw9xtQUWJr_GRopVL2prMf8AAriKAAIB78lKRGSTsH48XH82BA',
    DOCUMENT: 'BQACAgIAAxkBAAIBDGjkXsTGKlTn9aHwhphRoYA04B3WAAJSjwACdjcgSxiGTR3MEo83NgQ',
};