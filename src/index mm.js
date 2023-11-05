const Koa = require('../koa/lib/application')
const axios = require('axios')

const app = new Koa();

let a = ""

app.use(async (ctx, next) => {
    console.log(ctx.request.path);
    a += 1
    await next();
    a += 2
    console.log(a);
    ctx.body = a
})

app.use(async (ctx, next) => {
    a += 3
    await next()
    a += 4
})

app.use(async (ctx, next) => {
    const res = await axios.get("http://localhost:3222/")
    a += res.data
})

app.listen('3124', () => {
    console.log('run in 3124');
})
