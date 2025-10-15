import type { MyContext } from '../types';
import { pauseCourse } from '../features/course/course.service';

export async function pauseCommand(ctx: MyContext) {
    await pauseCourse(ctx);
}