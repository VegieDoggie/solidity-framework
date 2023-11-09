import chalk from "chalk";
import cp, {SingleBar} from "cli-progress";

const log = (...message: any[]) => write(...plainObject(message));
const success = (...message: any[]) => write(chalk.green(...plainObject(message)));
const warning = (...message: any[]) => write(chalk.yellow(...plainObject(message)));
const info = (...message: any[]) => write(chalk.blue(...plainObject(message)));
const error = (...message: any[]) => write(chalk.red(...plainObject(message)))
const debug = (...message: any[]) => write(chalk.whiteBright("🔧 [DEBUG]", ...plainObject(message)))
const write = (...message: any[]): void => {
    if (process.env.APP_ENV !== "test") {
        // TODO 记录日志
        console.log(...message);
    }
};
const plainObject = (message: any[]): any[] => {
    const wrapped: any[] = []
    for (const item of message) {
        if (typeof item === "object") {
            try {
                wrapped.push(JSON.stringify(item))
            } catch (e) {
                wrapped.push(item)
            }
        } else {
            wrapped.push(item)
        }
    }
    return wrapped
};

const progress = (title: string, ...tasks: string[]) => {
    const barFactory = new cp.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: '| {bar} | {value}/{total} | {filename}',
    }, cp.Presets.rect);
    if (title?.length) {
        success(title)
        // barFactory.log(chalk.blue(title))
    }
    let controller = {success: false, restart: false, pause: false};
    let timeout = 0;
    const bars: SingleBar[] = tasks.map(name => {
            return barFactory.create(100, 1, {filename: name})
        })
    ;(async () => {
        const progresses = bars.map(_ => 1)
        for (let i = 0; ; i++) {
            if (controller.success) {
                bars.forEach(bar => {
                    bar.update(bar.getTotal())
                    bar.stop();
                });
                break;
            }
            if (controller.restart) {
                bars.forEach(bar => bar.update(1));
                for (let j = 0; j < progresses.length; j++) {
                    progresses[j] = 1;
                }
                controller.restart = false
            }
            if (controller.pause) {
                timeout = 100;
                await new Promise(resolve => setTimeout(resolve, timeout));
                continue
            }
            let index = Math.floor(Math.random() * tasks.length)
            let progress = Math.floor(Math.random() * Math.max(bars[index].getTotal() - progresses[index], 6) / 5 + progresses[index])
            if (progresses[index] < progress && progress < bars[index].getTotal()) {
                progresses[index] = progress
                bars[index].update(progress)
            }
            if (Math.random() < 0.5) {
                timeout = Math.min(Math.max(i * tasks.length, 60), 200);
                await new Promise(resolve => setTimeout(resolve, timeout));
            }
        }
    })();
    return {
        restart: async () => {
            controller.restart = true;
            await new Promise(resolve => setTimeout(resolve, timeout));
        },
        success: async () => {
            controller.success = true;
            await new Promise(resolve => setTimeout(resolve, timeout));
        },
        pause: async (pause: boolean) => {
            controller.pause = pause;
            await new Promise(resolve => setTimeout(resolve, timeout));
        },
        stop: () => {
            barFactory.stop()
        }
    };
};

const progressCall = async (title: string, func: any, ...tasks: string[]) => {
    const p1 = progress(title, ...tasks);
    let result
    try {
        result = await func()
        await p1.success()
    } catch (e) {
        await p1.pause(true)
        throw e
    } finally {
        p1.stop()
    }

    return result
}

export default {success, warning, info, error, log, debug, progress, progressCall};
