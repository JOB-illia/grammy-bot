import type { MyContext, AssessmentResult } from '../../types';

export async function finishAssessment(ctx: MyContext): Promise<void> {
    const assessment = ctx.session.currentAssessment;
    if (!assessment) return;

    const yesCount = ctx.session.assessmentAnswers!.filter(answer => answer).length;
    const totalQuestions = assessment.questions.length;

    const range = assessment.ranges.find(r => yesCount >= r.min && yesCount <= r.max);

    if (!range) {
        await ctx.reply('❌ Błąd w obliczaniu wyniku. Spróbuj ponownie.');
        return;
    }

    const assessmentResult: AssessmentResult = {
        quizTitle: assessment.title,
        yesCount,
        totalQuestions,
        range,
        completedAt: new Date().toISOString()
    };

    if (!ctx.session.assessmentResults) {
        ctx.session.assessmentResults = [];
    }

    ctx.session.assessmentResults.push(assessmentResult);

    const resultMessage =
        `📊 *Wyniki: ${assessment.title}*\n\n` +
        `✅ Masz ${yesCount} odpowiedzi "Tak" z ${totalQuestions} pytań\n\n` +
        '=============\n' +
        '=============\n\n' +
        `*${range.title}*\n\n` +
        `${range.description}`;

    const keyboard = range.advice ? {
        inline_keyboard: [[
            { text: '💡 Zobacz porady', callback_data: 'show_assessment_advice' },
            { text: '▶️ Dalej', callback_data: 'assessment_continue' }
        ]]
    } : {
        inline_keyboard: [[
            { text: '▶️ Dalej', callback_data: 'assessment_continue' }
        ]]
    };

    await ctx.reply(resultMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });

    if (range.advice) {
        ctx.session.lastAssessmentAdvice = range.advice;
    }
}

export async function showAssessmentResults(ctx: MyContext): Promise<void> {
    if (!ctx.session.assessmentResults || ctx.session.assessmentResults.length === 0) {
        await ctx.reply('🔍 Nie masz jeszcze żadnych ukończonych testów samooceny');
        return;
    }

    let message = `📋 *Twoje wyniki testów samooceny:*\n\n`;

    ctx.session.assessmentResults.forEach((result, index) => {
        const date = new Date(result.completedAt).toLocaleDateString('pl-PL');
        message += `${index + 1}. **${result.quizTitle}**\n`;
        message += `   ✅ Odpowiedzi "Tak": ${result.yesCount}/${result.totalQuestions}\n`;
        message += `   🎯 ${result.range.title}\n`;
        message += `   📅 Data: ${date}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
}