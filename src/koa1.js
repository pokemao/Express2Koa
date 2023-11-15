const Koa = require('koa')

/** 断点 */const app = new Koa();

/** 断点 */app.use(async function middleware1(ctx, next) {
    /** 断点 */console.log(1);
    const a = await next();
    /** 断点 */console.log(a);
    console.log(2);
    /** 断点 */ctx.body = `
    打印
    1
    3
    5
    4
    6
    second
    2
    third
    `
})

app.use(async function middleware2(ctx, next) {
    /** 断点 */console.log(3);
    next().then(res => {
        console.log(res);
    });
    /** 断点 */console.log(4);
    return "second"
})

app.use(async function middleware3(ctx, next) {
    /** 断点 */console.log(5);
    await next(); // Promise.reslove()
    /** 断点 */console.log(6);
    return "third"
})

/** 断点 */app.listen('3124', () => {
    console.log('run in 3124');
})
