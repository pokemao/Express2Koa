const Koa = require('../koa/lib/application')

const app = new Koa();

app.use(async (ctx, next) => {
    console.log(1);
    const a = await next();
    console.log(a);
    console.log(2);
})

app.use(async (ctx, next) => {
    console.log(3);
    next().then(res => {
        console.log(res);
    });
    console.log(4);
    return "second"
})

app.use(async (ctx, next) => {
    console.log(5);
    await next(); // Promise.reslove()
    console.log(6);
    return "third"
})

app.listen('3124', () => {
    console.log('run in 3124');
})
