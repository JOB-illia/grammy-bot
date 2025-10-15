import type { MyContext } from '../types';
import { resumeCourse } from '../features/course/course.service';

export async function resumeCommand(ctx: MyContext) {
    await resumeCourse(ctx);
}